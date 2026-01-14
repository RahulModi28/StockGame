from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
import asyncio
from sqlalchemy.orm import Session, joinedload
from .. import crud, models, schemas
from ..database import get_db, get_redis_client
from ..dependencies import require_admin
import random
import json
from datetime import datetime

router = APIRouter(
    tags=["admin"],
    dependencies=[Depends(require_admin)]
)

# --- Market Control ---

@router.post("/market/status")
def set_market_status(status: schemas.MarketStatusUpdate):
    redis_client = get_redis_client()
    redis_client.set("market:is_open", 1 if status.is_open else 0)
    return {"message": f"Market is now {'OPEN' if status.is_open else 'CLOSED'}"}

@router.post("/market/volatility")
def set_volatility(update: schemas.VolatilityUpdate):
    redis_client = get_redis_client()
    redis_client.set("market:volatility", update.volatility)
    return {"message": f"Global Volatility factor set to {update.volatility}"}

@router.post("/market/chaos")
def set_chaos_mode(update: schemas.ChaosUpdate):
    redis_client = get_redis_client()
    redis_client.set("market:chaos_enabled", 1 if update.enabled else 0)
    return {"message": f"Chaos Mode {'ENABLED' if update.enabled else 'DISABLED'}"}

@router.post("/market/sector")
def set_sector_trend(update: schemas.SectorTrendUpdate):
    redis_client = get_redis_client()
    # Store trend: market:sector:Technology:trend = BULL
    redis_client.set(f"market:sector:{update.sector}:trend", update.trend)
    return {"message": f"Sector {update.sector} set to {update.trend}"}

@router.get("/market/sector")
def get_sector_trends():
    redis_client = get_redis_client()
    sectors = ['Technology', 'Finance', 'Consumer', 'Automotive', 'Healthcare']
    trends = {}
    for s in sectors:
        # Default to neutral/none if not set? Or "NORMAL"? 
        # API should probably return null or empty string if no override.
        val = redis_client.get(f"market:sector:{s}:trend")
        trends[s] = val 
    return trends

@router.post("/stock/price")
def override_price(override: schemas.PriceOverride):
    redis_client = get_redis_client()
    redis_client.set(f"company:{override.company_id}:price", override.price)
    crud.log_price_history(override.company_id, override.price, custom_timestamp=crud.get_game_time(redis_client))
    return {"message": f"Price for Company {override.company_id} set to {override.price}"}

@router.get("/market/cycle")
def get_market_cycle():
    redis_client = get_redis_client()
    trend = redis_client.get("market:trend") or "SIDEWAYS"
    phase = redis_client.get("market:phase") or "ACCUMULATION"
    return {"trend": trend, "phase": phase}

@router.post("/market/cycle")
def set_market_cycle(cycle: schemas.MarketCycleUpdate):
    redis_client = get_redis_client()
    if cycle.trend:
        redis_client.set("market:trend", cycle.trend)
    if cycle.phase:
        redis_client.set("market:phase", cycle.phase)
    return {"message": f"Market Cycle updated to {cycle.trend} - {cycle.phase}"}

@router.post("/init_game")
def init_game(db: Session = Depends(get_db)):
    # Seed Companies
    existing = crud.get_companies(db)
    if existing:
        return {"message": "Game already initialized"}
    
    companies = [
        {"name": "AlphaTech", "ticker": "ALPHA", "sector": "Tech", "current_price": 100.0, "total_shares": 1000000, "volatility_rating": 1.2},
        {"name": "GreenGrid Energy", "ticker": "GRID", "sector": "Energy", "current_price": 80.0, "total_shares": 1500000, "volatility_rating": 0.9},
        {"name": "FinNest Bank", "ticker": "NEST", "sector": "Finance", "current_price": 150.0, "total_shares": 800000, "volatility_rating": 1.0},
        {"name": "MediCare Corp", "ticker": "MEDI", "sector": "Healthcare", "current_price": 120.0, "total_shares": 1200000, "volatility_rating": 0.8},
        {"name": "AutoDrive Motors", "ticker": "AUTO", "sector": "Consumer", "current_price": 200.0, "total_shares": 500000, "volatility_rating": 1.5},
    ]
    
    for c in companies:
        # Use CRUD to handle Redis init
        company_in = schemas.CompanyCreate(**c)
        db_company = crud.create_company(db, company_in)
        # Log initial history
        crud.log_price_history(db_company.id, db_company.current_price, custom_timestamp=crud.get_game_time())
    
# --- Session Management ---

@router.post("/session/start")
def start_session(db: Session = Depends(get_db)):
    redis_client = get_redis_client()
    
    # 1. Reset Board: Clear Holdings, Trades, and News
    db.query(models.Holding).delete()
    db.query(models.Trade).delete()
    db.query(models.News).delete()
    
    # 2. Reset Users: Cash to 100k
    teams = db.query(models.Team).all()
    for team in teams:
        team.cash_balance = 100000.0
    
    # 3. Reset Companies: Prices to Original & Clear History
    companies = crud.get_companies(db)
    pipe = redis_client.pipeline()
    
    price_reset_count = 0
    for company in companies:
        original_price = company.price 
        pipe.set(f"company:{company.id}:price", original_price)
        
        # Clear History so chart starts fresh
        redis_client.delete(f"company:{company.id}:history")
        # Clear Candle Data
        redis_client.delete(f"company:{company.id}:candles:60")
        redis_client.delete(f"company:{company.id}:candle:current:60")
        
        # Clear Halt Status & Circuit Breakers
        redis_client.delete(f"company:{company.id}:halt")
        redis_client.delete(f"company:{company.id}:halted_until")
        redis_client.delete(f"company:{company.id}:cb_level")
        
        # Log this reset event alone (start of chart)
        crud.log_price_history(company.id, original_price, custom_timestamp=crud.get_game_time(redis_client))
        price_reset_count += 1
        
    # Clear Static List Cache (Critical for Halt Status reset)
    redis_client.delete("companies:static_list")
        
    # Clear Sector & Market Trends
    sectors = ['Technology', 'Finance', 'Consumer', 'Automotive', 'Healthcare']
    for s in sectors:
        redis_client.delete(f"market:sector:{s}:trend")
        
    redis_client.delete("market:trend")
    redis_client.delete("market:phase")

    # Set Virtual Start Time (Anchor to 9:15 AM)
    redis_client.set("market:session_start_time", datetime.utcnow().timestamp())
        
    # 4. Open Market
    pipe.set("market:is_open", 1)
    pipe.execute()
    
    db.commit()
    
    return {
        "message": f"Session Started! Reset {len(teams)} teams, cleared portfolios/news, and reset stocks."
    }

async def close_market_task(delay_minutes: int):
    if delay_minutes > 0:
        await asyncio.sleep(delay_minutes * 60)
        
    redis_client = get_redis_client()
    redis_client.set("market:is_open", 0)
    print(f"Market Closed after {delay_minutes} minutes delay.")

@router.post("/session/end")
def end_session(background_tasks: BackgroundTasks, delay_minutes: int = Query(0, ge=0), db: Session = Depends(get_db)):
    redis_client = get_redis_client()
    
    if delay_minutes == 0:
        redis_client.set("market:is_open", 0)
        return {"message": "Session Ended. Market Closed immediately."}
    else:
        background_tasks.add_task(close_market_task, delay_minutes)
        
        # ANNOUNCE: Create Breaking News
        news_item = schemas.NewsCreate(
            headline=f"⚠️ MARKET CLOSING IN {delay_minutes} MINUTES!",
            impact_score=0.0,
            is_breaking=True,
            sector_impacted="MARKET",
            company_id=None
        )
        crud.create_news(db, news_item)
        
        return {"message": f"Session ending in {delay_minutes} minutes. Notification sent."}


# --- Events & News ---

@router.post("/news/create")
def create_news(news: schemas.NewsCreate, db: Session = Depends(get_db)):
    return crud.create_news(db, news)

@router.post("/event/crash")
def trigger_crash(db: Session = Depends(get_db)):
    companies = crud.get_companies(db)
    redis_client = get_redis_client()
    
    for c in companies:
        drop = random.uniform(0.05, 0.15) # 5% to 15% drop
        new_price = c.current_price * (1 - drop)
        if new_price < 0.01: new_price = 0.01
        
        # Update Redis
        redis_client.set(f"company:{c.id}:price", new_price)
        crud.log_price_history(c.id, new_price)
    
    # Add News
    news = models.News(headline="MARKET CRASH! Panic selling across all sectors!", impact_score=-0.1, is_breaking=True)
    db.add(news)
    db.commit()
    return {"message": "Market Crash Triggered"}

@router.post("/event/dividend/{company_id}")
def trigger_dividend(company_id: int, amount: float = 2.0, db: Session = Depends(get_db)):
    company = crud.get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Payout to all holders
    holders = db.query(models.Holding).filter(models.Holding.company_id == company_id).all()
    count = 0
    total_payout = 0
    for h in holders:
        if h.quantity > 0:
            payout = h.quantity * amount
            h.team.cash_balance += payout
            count += 1
            total_payout += payout
            
    news = models.News(headline=f"DIVIDEND PAYOUT: {company.name} pays ₹{amount}/share!", impact_score=0.05, is_breaking=False, company_id=company_id)
    db.add(news)
    db.commit()
    return {"message": f"Paid dividends to {count} teams. Total: ₹{total_payout}"}

# --- User Management ---

@router.get("/users", response_model=list[schemas.Team])
def get_all_users(db: Session = Depends(get_db)):
    return crud.get_all_teams(db)

@router.get("/users/{user_id}/portfolio")
def get_user_portfolio(user_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, user_id)
    if not team:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate detailed portfolio (reusing logic from portfolio router could be better, but implementing direct fetch here)
    holdings_data = []
    companies = crud.get_companies(db)
    price_map = {c.id: c.current_price for c in companies}
    
    total_value = team.cash_balance
    
    for h in team.holdings:
        current_price = price_map.get(h.company_id, 0)
        value = h.quantity * current_price
        total_value += value
        holdings_data.append({
            "ticker": h.company.ticker,
            "quantity": h.quantity,
            "avg_price": h.average_buy_price,
            "current_price": current_price,
            "value": value
        })
        
    return {
        "user": team,
        "total_value": total_value,
        "holdings": holdings_data
    }

@router.post("/users/{user_id}/balance")
def adjust_balance(user_id: int, adjustment: schemas.BalanceAdjustment, db: Session = Depends(get_db)):
    team = crud.get_team(db, user_id)
    if not team:
        raise HTTPException(status_code=404, detail="User not found")
    
    if adjustment.type == "CREDIT":
        team.cash_balance += adjustment.amount
    elif adjustment.type == "DEBIT":
        team.cash_balance -= adjustment.amount
        
    db.commit()
    return {"message": f"Balance updated. New Balance: {team.cash_balance}"}

@router.post("/users/{user_id}/make-admin")
def make_admin(user_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, user_id)
    if not team:
        raise HTTPException(status_code=404, detail="User not found")
    
    team.is_admin = True
    db.commit()
    return {"message": f"User {team.name} is now an Admin"}

@router.post("/users/{user_id}/remove-admin")
def remove_admin(user_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, user_id)
    if not team:
        raise HTTPException(status_code=404, detail="User not found")
    
    team.is_admin = False
    db.commit()
    return {"message": f"User {team.name} demoted to regular user"}

@router.post("/users/{user_id}/ban")
def ban_user(user_id: int, req: schemas.BanRequest, db: Session = Depends(get_db)):
    # For now, we don't have an is_banned field on Team model, so we'll skip DB update
    # and just mock the success. In a real app, we'd add the column.
    # Or we can use redis to blacklist the token/user.
    redis_client = get_redis_client()
    redis_client.set(f"user:{user_id}:banned", 1 if req.is_banned else 0)
    return {"message": f"User {user_id} ban status set to {req.is_banned}"}

# --- Analytics ---

@router.get("/analytics/whales")
def get_whale_alert(threshold: float = 20000.0, db: Session = Depends(get_db)):
    # Fetch recent trades over threshold using eager loading for relationships
    trades = db.query(models.Trade)\
        .options(joinedload(models.Trade.team), joinedload(models.Trade.company))\
        .order_by(models.Trade.timestamp.desc())\
        .limit(100)\
        .all()
    
    whales = []
    
    for t in trades:
        # Calculate value (using stored price or fallback to current * qty if 0)
        trade_price = t.price if t.price is not None else 0.0
        trade_value = trade_price * t.quantity
        
        if trade_value > threshold:
             # Safety check if team/company deleted (though foreign keys should prevent)
             user_name = t.team.name if t.team else "Unknown Team"
             ticker = t.company.ticker if t.company else "UNKNOWN"
             
             whales.append({
                 "time": t.timestamp.isoformat(), # Ensure serializable
                 "user": user_name,
                 "ticker": ticker,
                 "type": t.type,
                 "quantity": t.quantity,
                 "value": trade_value
             })
             
    return whales
