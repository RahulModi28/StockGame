from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db, get_redis_client
import math
import asyncio
import json
from datetime import datetime

router = APIRouter()

@router.get("/companies", response_model=list[schemas.Company])
def read_companies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    companies = crud.get_companies(db)
    return companies

@router.get("/history/{company_id}")
def read_price_history(company_id: int):
    # Fetch from Redis
    return crud.get_price_history(company_id)

@router.get("/candles/{company_id}")
def read_candles(company_id: int, interval: int = 60):
    # Interval in seconds, default 1 min
    return crud.get_ohlc_data(company_id, interval)

@router.get("/status")
def get_market_status():
    redis_client = get_redis_client()
    is_open_val = redis_client.get("market:is_open")
    chaos_val = redis_client.get("market:chaos_enabled")
    
    is_open = (is_open_val is not None) and (int(is_open_val) == 1)
    chaos_enabled = (chaos_val is not None) and (int(chaos_val) == 1)
    
    return {
        "is_open": is_open,
        "chaos_enabled": chaos_enabled,
        "session_start_time": redis_client.get("market:session_start_time")
    }

@router.get("/cycle")
def get_market_cycle():
    """Public endpoint to get market cycle information (trend and phase)"""
    redis_client = get_redis_client()
    trend = redis_client.get("market:trend") or "SIDEWAYS"
    phase = redis_client.get("market:phase") or "ACCUMULATION"
    return {"trend": trend, "phase": phase}

@router.post("/trade", response_model=schemas.Trade)
def trade_stock(trade: schemas.TradeCreate, team_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Data
    # Lock the team row to prevent race conditions (double spending)
    team = db.query(models.Team).filter(models.Team.id == team_id).with_for_update().first()
    company = crud.get_company(db, trade.company_id)
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # 2. Check Market Status
    redis_client = get_redis_client()
    is_open = redis_client.get("market:is_open")
    # Redis returns string bytes usually, or None. '0' is closed.
    if is_open is not None and int(is_open) == 0:
        raise HTTPException(status_code=400, detail="The Market is Closed. No trading allowed.")

    # 3. Check Halt
    if company.is_halted:
        # Check if timer expired
        if company.halted_until and company.halted_until < datetime.utcnow():
            # Timer expired, effectively un-halted for this transaction
            # (We relying on lazy expiration or background cleanup, but this allows specific trade)
            pass
        else:
            raise HTTPException(status_code=400, detail="Trading is currently HALTED for this stock.")

    # 4. Calculate Transaction Cost/Revenue
    from decimal import Decimal
    
    # Ensure precision for money
    current_price = float(company.current_price)
    transaction_val = current_price * trade.quantity
    # Round to 2 decimals
    transaction_amount = Decimal(f"{transaction_val:.2f}")
    
    if trade.type == "buy":
        # Check Balance
        if team.cash_balance < transaction_amount:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        
        # Execute Money Transfer
        team.cash_balance -= transaction_amount
        
        # Update Holding
        holding = crud.get_holding(db, team_id, trade.company_id)
        if not holding:
            holding = models.Holding(team_id=team_id, company_id=trade.company_id, quantity=0, average_buy_price=Decimal(0))
            db.add(holding)
        
        # Weighted Average Price
        # Ensure Decimal ops
        avg_price = holding.average_buy_price or Decimal(0)
        total_cost_old = holding.quantity * avg_price
        new_total_cost = total_cost_old + transaction_amount
        new_quantity = holding.quantity + trade.quantity
        if new_quantity > 0:
            holding.average_buy_price = new_total_cost / new_quantity
        holding.quantity = new_quantity
        
        # Price Impact: (shares_bought / total_shares) * volatility_multiplier
        impact_pct = (trade.quantity / company.total_shares) * company.volatility_rating
        # Cap impact per trade to avoid explosion? Maybe. User didn't specify, but safer.
        # User Formula: Price Increase (%)
        new_price = current_price * (1 + impact_pct)
        
    elif trade.type == "sell":
        # Check Holding
        holding = crud.get_holding(db, team_id, trade.company_id)
        if not holding or holding.quantity < trade.quantity:
             raise HTTPException(status_code=400, detail="Insufficient shares")
        
        # Execute Money Transfer
        team.cash_balance += transaction_amount
        
        # Update Holding
        holding.quantity -= trade.quantity # Avg buy price doesn't change on sell
        if holding.quantity == 0:
            db.delete(holding) # Optional: keep with 0 or delete
            
        # Price Impact: (shares_sold / total_shares) * volatility_multiplier * 1.2
        impact_pct = (trade.quantity / company.total_shares) * company.volatility_rating * 1.2
        new_price = current_price * (1 - impact_pct)
        
        # Calculate Realized Profit
        # profit = (sell_price - avg_buy_price) * quantity
        # Use Decimal for profit calc to match column
        # current_price can be float, avg_buy_price is Decimal
        sell_price_dec = Decimal(f"{current_price:.2f}")
        avg_buy_price = holding.average_buy_price or Decimal(0)
        realized_profit = (sell_price_dec - avg_buy_price) * trade.quantity
        
    else:
         raise HTTPException(status_code=400, detail="Invalid trade type")

    # 4. Safeguards
    if new_price < 10.0: new_price = 10.0
    if new_price > 1000.0: new_price = 1000.0
    
    # Update Redis
    redis_client = get_redis_client()
    redis_client.set(f"company:{company.id}:price", new_price)
    
    # Log History
    crud.log_price_history(company.id, new_price)
    crud.update_ohlc_candle(company.id, new_price)
    
    # Update local object for response
    company.current_price = new_price
    
    # --- CIRCUIT BREAKER CHECK ---
    from datetime import timedelta
    opening_price = company.opening_price
    if opening_price and opening_price > 0:
        total_change_pct = (new_price - float(opening_price)) / float(opening_price)
        abs_change = abs(total_change_pct)
        
        current_level = company.circuit_breaker_level
        halt_duration = 0
        new_level = current_level
        halt_msg = ""
        
        if abs_change >= 0.1995 and current_level < 3:
            new_level = 3
            halt_duration = 86400
            halt_msg = f"TRADING HALT: {company.ticker} hits 20% limit! Market suspended."
        elif abs_change >= 0.1495 and current_level < 2:
            new_level = 2
            halt_duration = 300
            halt_msg = f"TRADING HALT: {company.ticker} spikes 15%. Paused for 5 min."
        elif abs_change >= 0.0995 and current_level < 1:
            new_level = 1
            halt_duration = 300
            halt_msg = f"TRADING HALT: {company.ticker} moves 10%. Circuit breaker tripped."
            
        if new_level > current_level:
            halt_until = datetime.utcnow() + timedelta(seconds=halt_duration)
            redis_client.set(f"company:{company.id}:halted_until", halt_until.timestamp())
            redis_client.set(f"company:{company.id}:cb_level", new_level)
            redis_client.set(f"company:{company.id}:halt", 1)
            
            # Create News
            halt_news = models.News(
                headline=halt_msg,
                impact_score=0,
                is_breaking=True,
                company_id=company.id,
                released_at=datetime.utcnow()
            )
            db.add(halt_news)
    # -----------------------------

    # 5. Record Trade
    db_trade = models.Trade(
        team_id=team_id,
        company_id=company.id,
        type=trade.type,
        quantity=trade.quantity,
        price=current_price, # We record execution price
        realized_profit=realized_profit if trade.type == "sell" else None,
        timestamp=datetime.utcnow()
    )
    db.add(db_trade)
    
    # 6. Whale Alert Logic
    # If transaction > 5% of total value? or just strict amount > 1000 shares?
    # Let's say > ₹50,000 value or > 1% of total shares logic
    whale_threshold_value = 20000 
    if transaction_amount > whale_threshold_value:
        # Create News Event for Whale
        action_verb = "BOUGHT" if trade.type == "buy" else "SOLD"
        headline = f"WHALE ALERT: {team.name} just {action_verb} {trade.quantity} shares of {company.ticker}!"
        # No price impact from the news itself, just the trade
        whale_news = models.News(
            headline=headline,
            impact_score=0,
            is_breaking=True, # Breaking news for marquee/toast
            released_at=datetime.utcnow()
        )
        db.add(whale_news)

    db.commit()
    return db_trade

@router.get("/stream/{company_id}")
async def stream_price(company_id: int):
    async def event_generator():
        redis_client = get_redis_client()
        while True:
            # Poll Redis
            # We want current candle for interval 60 (default)
            current_key = f"company:{company_id}:candle:current:60"
            raw_candle = redis_client.get(current_key)
            
            if raw_candle:
                # SSE data is the candle object
                yield f"data: {raw_candle}\n\n"
            
            # 2 second update (0.5Hz)
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
