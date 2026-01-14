from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from . import models, schemas
from datetime import datetime
from .database import get_redis_client
import math
import json

# Team Operations
def get_team(db: Session, team_id: int):
    return db.query(models.Team).filter(models.Team.id == team_id).first()

def get_team_by_name(db: Session, name: str):
    return db.query(models.Team).filter(models.Team.name == name).first()

def create_team(db: Session, team: schemas.TeamCreate):
    # In a real app, hash the access_code
    db_team = models.Team(name=team.name, access_code=team.access_code)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

def get_all_teams(db: Session):
    return db.query(models.Team).all()

# Company Operations
def get_company(db: Session, company_id: int):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        return None
    
    # Merge with Redis data
    redis_client = get_redis_client()
    price_key = f"company:{company_id}:price"
    volatility_key = f"company:{company_id}:volatility"
    halt_key = f"company:{company_id}:halt"
    
    current_price = redis_client.get(price_key)
    volatility = redis_client.get(volatility_key)
    is_halted = redis_client.get(halt_key)
    
    # Create a schema object or modify the ORM object if possible 
    # But since ORM object is bound to session, better to return something that matches schema
    # Actually, Pydantic's from_orm might fail if attributes are missing on ORM object.
    # Let's attach them to the object directly. accessing non-column attributes is fine in Python.
    halted_until_ts = redis_client.get(f"company:{company_id}:halted_until")
    cb_level = redis_client.get(f"company:{company_id}:cb_level")
    
    company.current_price = float(current_price) if current_price else company.price
    company.volatility_rating = float(volatility) if volatility else 1.0
    company.is_halted = (is_halted == '1')
    
    if halted_until_ts:
        try:
            company.halted_until = datetime.fromtimestamp(float(halted_until_ts))
        except:
            company.halted_until = None
    else:
        company.halted_until = None
        
    company.circuit_breaker_level = int(cb_level) if cb_level else 0
    company.opening_price = company.price
    
    return company

from datetime import datetime, timedelta

def get_game_time(redis_client=None):
    """Calculates virtual game time based on session start anchor."""
    try:
        if redis_client is None:
            redis_client = get_redis_client()
            
        start_ts = redis_client.get("market:session_start_time")
        if not start_ts:
            return datetime.utcnow()
        
        session_start_dt = datetime.utcfromtimestamp(float(start_ts))
        
        # Virtual Anchor: Today at 9:15 AM
        virtual_anchor = session_start_dt.replace(hour=9, minute=15, second=0, microsecond=0)
        
        elapsed = datetime.utcnow() - session_start_dt
        return virtual_anchor + elapsed
    except Exception:
        return datetime.utcnow()

def get_companies(db: Session):
    redis_client = get_redis_client()
    static_key = "companies:static_list"
    
    # 1. Try Cache for Static Data
    cached_data = redis_client.get(static_key)
    companies = []
    
    if cached_data:
        try:
            company_dicts = json.loads(cached_data)
            # Reconstruct transient objects (detached from session)
            for d in company_dicts:
                # We need to ensure we don't pass extra fields if schema changed
                # For now assuming simple direct mapping
                c = models.Company(**d)
                companies.append(c)
        except Exception as e:
            print(f"Cache Error: {e}")
            companies = [] # Fallback
            
    if not companies:
        # 2. DB Fallback
        companies = db.query(models.Company).all()
        # Serialize and Cache
        to_cache = []
        for c in companies:
            c_dict = {
                "id": c.id,
                "name": c.name,
                "ticker": c.ticker,
                "sector": c.sector,
                "total_shares": c.total_shares,
                "price": float(c.price), # Ensure Float for JSON
                "volatility_rating": c.volatility_rating, # Base volatility
                "is_halted": c.is_halted, # Base halt status
                # Skip created_at for simplicity or parse it if needed
            }
            to_cache.append(c_dict)
        # Cache for 1 hour
        redis_client.set(static_key, json.dumps(to_cache), ex=3600)
    
    # 3. Overlay Real-time Data (Existing Logic)
    # Use pipeline to fetch all data in one round-trip
    pipe = redis_client.pipeline()
    for company in companies:
        pipe.get(f"company:{company.id}:price")
        pipe.get(f"company:{company.id}:volatility")
        pipe.get(f"company:{company.id}:halt")
        pipe.get(f"company:{company.id}:halted_until")
        pipe.get(f"company:{company.id}:cb_level")
        
    results = pipe.execute()
    
    # Map results back to companies
    # Results array is [price1, vol1, halt1, h_until1, cb_lvl1, price2, ...]
    for i, company in enumerate(companies):
        base_idx = i * 5
        current_price = results[base_idx]
        volatility = results[base_idx + 1]
        is_halted = results[base_idx + 2]
        halted_until_ts = results[base_idx + 3]
        cb_level = results[base_idx + 4]
        
        company.current_price = float(current_price) if current_price else float(company.price)
        company.volatility_rating = float(volatility) if volatility else 1.0
        company.is_halted = (is_halted == '1')
        
        if halted_until_ts:
            try:
                company.halted_until = datetime.fromtimestamp(float(halted_until_ts))
            except:
                company.halted_until = None
        else:
            company.halted_until = None
            
        company.circuit_breaker_level = int(cb_level) if cb_level else 0
        company.opening_price = float(company.price)
        
    return companies

def create_company(db: Session, company: schemas.CompanyCreate):
    # Separate static and dynamic
    static_data = company.dict(exclude={'current_price', 'volatility_rating', 'is_halted', 'dividend_yield'})
    # We might have extra fields in the input that match the old model but not the new one.
    # The dictionary will contain them, but **static_data will crash if model doesn't have them?
    # Actually Pydantic dict() includes all fields.
    # We need to manually filter or use explicit arguments.
    
    db_company = models.Company(
        name=company.name,
        ticker=company.ticker,
        sector=company.sector,
        total_shares=company.total_shares
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    
    # Invalidate static list cache
    redis_client = get_redis_client()
    redis_client.delete("companies:static_list")
    redis_client.set(f"company:{db_company.id}:price", company.current_price)
    redis_client.set(f"company:{db_company.id}:volatility", company.volatility_rating)
    redis_client.set(f"company:{db_company.id}:halt", 1 if company.is_halted else 0)
    redis_client.set(f"company:{db_company.id}:cb_level", 0)
    
    # Attach for return
    db_company.current_price = company.current_price
    db_company.volatility_rating = company.volatility_rating
    
    db_company.volatility_rating = company.volatility_rating
    
    return db_company

# Price History Operations
def log_price_history(company_id: int, price: float, custom_timestamp: datetime = None):
    redis_client = get_redis_client()
    key = f"company:{company_id}:history"
    
    ts = custom_timestamp.isoformat() if custom_timestamp else datetime.utcnow().isoformat()
    
    entry = {
        "timestamp": ts,
        "price": float(price) # Ensure float
    }
    
    # Use pipeline for efficiency
    pipe = redis_client.pipeline()
    pipe.rpush(key, json.dumps(entry))
    # Trim to keep only last 1000 points
    pipe.ltrim(key, -1000, -1)
    pipe.execute()

def update_ohlc_candle(company_id: int, price: float, interval_seconds: int = 60):
    """
    Updates the current candle in Redis.
    Structure: "company:{id}:candles:{interval}" -> List of JSON objects
    Also maintains a "current_candle" key for real-time updates.
    """
    redis_client = get_redis_client()
    now = datetime.utcnow()
    timestamp = now.timestamp()
    
    # Calculate bucket based on interval
    bucket_ts = math.floor(timestamp / interval_seconds) * interval_seconds
    bucket_str = datetime.utcfromtimestamp(bucket_ts).isoformat()
    
    current_key = f"company:{company_id}:candle:current:{interval_seconds}"
    list_key = f"company:{company_id}:candles:{interval_seconds}"
    
    # Get current candle from Redis
    raw_current = redis_client.get(current_key)
    
    if raw_current:
        current_candle = json.loads(raw_current)
        # Check if we are still in the same bucket
        if current_candle["time"] == bucket_ts:
             # Update High/Low/Close
             current_candle["high"] = max(current_candle["high"], price)
             current_candle["low"] = min(current_candle["low"], price)
             current_candle["close"] = price
             
             # Save back
             redis_client.set(current_key, json.dumps(current_candle))
             return current_candle
        else:
            # Bucket changed! Push the OLD candle to the list
            # But wait, we only have the 'current' state in Redis.
            # We must push the COMPLETED candle to the historical list.
            
            # The current_candle in Redis is from the PREVIOUS bucket.
            # Push it to history.
            redis_client.rpush(list_key, json.dumps(current_candle))
            redis_client.ltrim(list_key, -5000, -1) # Keep last 5000 candles
            
            # Start NEW candle
            new_candle = {
                "time": bucket_ts,
                "open": price,
                "high": price,
                "low": price,
                "close": price
            }
            redis_client.set(current_key, json.dumps(new_candle))
            return new_candle
    else:
        # No current candle, start one
        new_candle = {
            "time": bucket_ts,
            "open": price,
            "high": price,
            "low": price,
            "close": price
        }
        redis_client.set(current_key, json.dumps(new_candle))
        return new_candle

def get_price_history(company_id: int):
    redis_client = get_redis_client()
    key = f"company:{company_id}:history"
    
    # Get all items in list
    history_json = redis_client.lrange(key, 0, -1)
    
    # Parse JSON
    return [json.loads(item) for item in history_json]

def get_ohlc_data(company_id: int, interval_seconds: int = 60):
    """
    Fetches OHLC candles from Redis.
    Merges historical list with current incomplete candle.
    """
    redis_client = get_redis_client()
    list_key = f"company:{company_id}:candles:{interval_seconds}"
    current_key = f"company:{company_id}:candle:current:{interval_seconds}"
    
    # 1. Get History
    history_json = redis_client.lrange(list_key, 0, -1)
    candles = [json.loads(x) for x in history_json]
    
    # 2. Get Current Candle
    raw_current = redis_client.get(current_key)
    if raw_current:
        current_candle = json.loads(raw_current)
        # Verify it's not a duplicate time (shouldn't be if logic is correct)
        # But if it is, the current one is newer updates, so typically we append.
        if not candles or candles[-1]["time"] != current_candle["time"]:
            candles.append(current_candle)
        else:
            # Overwrite last one if time matches (should typically be push & new)
            candles[-1] = current_candle

    return candles

# Trading Operations
def get_holding(db: Session, team_id: int, company_id: int):
    return db.query(models.Holding).filter(models.Holding.team_id == team_id, models.Holding.company_id == company_id).first()

def create_trade(db: Session, trade: schemas.TradeCreate, team_id: int, price: float = 0.0):
    # This function assumes validation (cash/shares check) happens in the router or service layer calls
    # For MVP, we'll put transaction logic in the router to handle price updates atomically with the trade.
    
    db_trade = models.Trade(
        team_id=team_id,
        company_id=trade.company_id,
        type=trade.type,
        quantity=trade.quantity,
        price=price,
        timestamp=datetime.utcnow()
    )
    return db_trade

# News Operations
def create_news(db: Session, news: schemas.NewsCreate):
    db_news = models.News(
        headline=news.headline,
        impact_score=news.impact_score,
        sector_impacted=news.sector_impacted,
        company_id=news.company_id,
        is_breaking=news.is_breaking,
        released_at=get_game_time()
    )
    db.add(db_news)
    db.commit()
    db.refresh(db_news)
    return db_news

def get_latest_news(db: Session, limit: int = 10):
    return db.query(models.News).order_by(desc(models.News.released_at), desc(models.News.id)).limit(limit).all()

# Leaderboard
from sqlalchemy.orm import selectinload

# Leaderboard
def get_leaderboard(db: Session):
    redis_client = get_redis_client()
    cache_key = "leaderboard:global"
    
    # 1. Try Cache
    cached = redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except:
            pass
            
    # 2. Optimized Query (Eager Load Holdings)
    # Using selectinload for 1-to-N relationships (Team -> Holdings). 
    teams = db.query(models.Team).options(
        selectinload(models.Team.holdings)
    ).all()
    
    # 3. Aggregate Trade Stats efficiently
    # We want: Total Trades, Win Rate (profitable trades / total trades)
    # Group by team_id
    from sqlalchemy import case
    
    trade_stats = db.query(
        models.Trade.team_id,
        func.count(models.Trade.id).label("total_trades"),
        func.sum(case((models.Trade.realized_profit > 0, 1), else_=0)).label("winning_trades")
    ).group_by(models.Trade.team_id).all()
    
    # Convert to dict for fast lookup
    stats_map = {
        stat.team_id: {
            "total_trades": stat.total_trades,
            "winning_trades": stat.winning_trades or 0
        } 
        for stat in trade_stats
    }
    
    leaderboard = []
    
    # Need prices for calculation
    companies = get_companies(db) # Cached
    price_map = {c.id: c.current_price for c in companies}
    
    for team in teams:
        holdings_value = 0.0
        for holding in team.holdings:
             if holding.company_id in price_map:
                holdings_value += holding.quantity * price_map[holding.company_id]
             
        total_value = float(team.cash_balance) + holdings_value
        
        # Stats
        t_stats = stats_map.get(team.id, {"total_trades": 0, "winning_trades": 0})
        total_trades = t_stats["total_trades"]
        winning_trades = t_stats["winning_trades"]
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        
        # Simple Trend Logic based on return
        start_balance = 100000.0 # Assumption
        current_return = total_value - start_balance
        if current_return > 5000:
            trend = "up"
        elif current_return < -5000:
            trend = "down"
        else:
            trend = "neutral"
            
        leaderboard.append({
            "id": team.id,
            "name": team.name,
            "cash_balance": float(team.cash_balance),
            "holdings_value": holdings_value,
            "total_value": total_value,
            "trades_count": total_trades,
            "win_rate": win_rate,
            "trend": trend,
            "avatar_seed": team.name # Ensure frontend has this
        })
    
    # Sort by total_value desc
    leaderboard.sort(key=lambda x: x["total_value"], reverse=True)
    
    # 4. Cache Result (30 seconds)
    redis_client.set(cache_key, json.dumps(leaderboard), ex=30)
    
    return leaderboard

# Limit Order Operations
def create_limit_order(db: Session, order: schemas.LimitOrderCreate, team_id: int):
    # Verify company exists
    company_price = get_company(db, order.company_id).current_price
    
    db_order = models.LimitOrder(
        team_id=team_id,
        company_id=order.company_id,
        type=order.type,
        trigger_price=order.trigger_price,
        quantity=order.quantity,
        status="PENDING"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

def get_limit_orders(db: Session, team_id: int):
    return db.query(models.LimitOrder)\
        .filter(models.LimitOrder.team_id == team_id, models.LimitOrder.status == "PENDING")\
        .order_by(desc(models.LimitOrder.created_at))\
        .all()

def update_limit_order(db: Session, order_id: int, team_id: int, updates: schemas.LimitOrderUpdate):
    order = db.query(models.LimitOrder)\
        .filter(models.LimitOrder.id == order_id, models.LimitOrder.team_id == team_id)\
        .first()
        
    if order and order.status == "PENDING":
        if updates.trigger_price is not None:
             order.trigger_price = updates.trigger_price
        if updates.quantity is not None:
             order.quantity = updates.quantity
        db.commit()
        db.refresh(order)
        return order
    return None

def delete_limit_order(db: Session, order_id: int, team_id: int):
    order = db.query(models.LimitOrder)\
        .filter(models.LimitOrder.id == order_id, models.LimitOrder.team_id == team_id)\
        .first()
        
    if order:
        order.status = "CANCELLED"
        db.commit()
        return True
    return False

def get_all_active_orders(db: Session):
    # For background worker
    return db.query(models.LimitOrder)\
        .filter(models.LimitOrder.status == "PENDING")\
        .all()
