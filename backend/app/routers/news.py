from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=list[schemas.News])
def read_news(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    # In a real game, filtering by 'released_at' < now would be here if we pre-seed future news.
    # For now, just return all.
    return crud.get_latest_news(db, limit)

from ..services.market_maker import market_director
import random

@router.post("/insider/buy")
def buy_insider_tip(team_id: int, db: Session = Depends(get_db)):
    # 1. Deduct Cost
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    cost = 5000.0
    if team.cash_balance < cost:
        raise HTTPException(status_code=400, detail="Insufficient funds for Insider Tip")
        
    team.cash_balance -= cost
    
    # 2. Schedule REAL Future Event
    companies = crud.get_companies(db)
    if not companies:
        raise HTTPException(status_code=500, detail="No companies to tip on")
        
    target = random.choice(companies)
    
    # Decide Outcome (Good or Bad news)
    direction = 1 if random.random() > 0.5 else -1
    pct = random.uniform(0.05, 0.15) * direction # 5-15% move
    
    delay_seconds = 120 # 2 Minutes
    
    # Schedule it
    market_director.schedule_event(
        db, 
        event_type="price_move",
        target_id=target.id,
        params={
            "pct_change": pct,
            "headline": f"{target.name} reacts sharply to internal reports."
        },
        delay_seconds=delay_seconds
    )
    
    # 3. Generate Tip Message
    move_text = "SURGE" if pct > 0 else "PLUMMET"
    tip_msg = f"INSIDER: Reliable sources confirm {target.name} ({target.ticker}) will {move_text} by approx {abs(pct)*100:.0f}% in exactly 2 minutes."
    
    db.commit()
    return {"message": "Tip Purchased", "tip": tip_msg, "cost": cost}
