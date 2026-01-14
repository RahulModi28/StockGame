from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter()

@router.get("/{team_id}")
def read_portfolio(team_id: int, db: Session = Depends(get_db)):
    # Optimized query with eager loading to prevent N+1 problems
    # Use selectinload for collections to avoid Cartesian product of Holdings x Trades
    # Optimized query: Load holdings eagerly, but NOT trades (too many)
    from sqlalchemy.orm import joinedload, selectinload
    from sqlalchemy import func, desc
    
    # 1. Fetch Team + Holdings
    team = db.query(models.Team).options(
       selectinload(models.Team.holdings).joinedload(models.Holding.company)
    ).filter(models.Team.id == team_id).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Calculate current value
    portfolio_value = 0.0
    holdings_data = []
    
    # 2. Fetch live prices from Redis
    if team.holdings:
        from ..database import get_redis_client
        redis_client = get_redis_client()
        pipe = redis_client.pipeline()
        
        for h in team.holdings:
            pipe.get(f"company:{h.company_id}:price")
            
        prices = pipe.execute()
    else:
        prices = []

    # 3. Build Holdings Data + Unrealized PnL
    for i, h in enumerate(team.holdings):
        current_price = float(prices[i]) if prices[i] else 0.0
        # h.company is an ORM object. We need to serialize it safely.
        # We also need to ensure current_price is passed.
        
        company_dict = {
            "id": h.company.id,
            "name": h.company.name,
            "ticker": h.company.ticker,
            "sector": h.company.sector,
            "current_price": current_price,
            "opening_price": h.company.price, # Fallback to base price as opening
            "is_halted": h.company.is_halted
        }
        
        current_val = h.quantity * current_price
        portfolio_value += current_val
        
        # FIX: Ensure compatible types (Decimal vs Float)
        avg_buy_price = float(h.average_buy_price) if h.average_buy_price else 0.0
        profit_loss = current_val - (h.quantity * avg_buy_price)
        
        holdings_data.append({
            "company": company_dict,
            "quantity": h.quantity,
            "average_buy_price": avg_buy_price,
            "current_value": current_val,
            "profit_loss": profit_loss
        })
        
    unrealized_pnl = sum(h['profit_loss'] for h in holdings_data)
    
    # 4. Realized PNL (Efficient DB Sum)
    realized_pnl_dec = db.query(func.sum(models.Trade.realized_profit))\
        .filter(models.Trade.team_id == team_id)\
        .scalar()
    realized_pnl = float(realized_pnl_dec) if realized_pnl_dec else 0.0
    
    total_profit_loss = unrealized_pnl + realized_pnl

    # 5. Recent Trades (Efficient DB Limit)
    recent_trades_db = db.query(models.Trade)\
        .options(joinedload(models.Trade.company))\
        .filter(models.Trade.team_id == team_id)\
        .order_by(desc(models.Trade.timestamp))\
        .limit(50)\
        .all()

    return {
        "team_id": team.id,
        "name": team.name,
        "cash_balance": team.cash_balance,
        "portfolio_value": portfolio_value,
        "total_equity": float(team.cash_balance) + portfolio_value,
        "total_profit_loss": total_profit_loss,
        "unrealized_pnl": unrealized_pnl,
        "realized_pnl": realized_pnl,
        "holdings": holdings_data,
        "recent_trades": [
            {
                "id": t.id,
                "ticker": t.company.ticker,
                "type": t.type,
                "quantity": t.quantity,
                "price": t.price,
                "realized_profit": t.realized_profit,
                "timestamp": t.timestamp
            } 
            for t in recent_trades_db
        ]
    }

@router.get("/leaderboard/global")
def read_leaderboard(db: Session = Depends(get_db)):
    return crud.get_leaderboard(db)
