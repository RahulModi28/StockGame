from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime
from decimal import Decimal
from .database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    # Simple password or access code for MVP
    access_code = Column(String, nullable=True) 
    # Firebase Auth Fields
    email = Column(String, unique=True, index=True, nullable=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=True)
    cash_balance = Column(DECIMAL(18, 2), default=100000.00)
    is_admin = Column(Boolean, default=False)

    holdings = relationship("Holding", back_populates="team")
    trades = relationship("Trade", back_populates="team")

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    ticker = Column(String, unique=True, index=True)
    sector = Column(String, index=True)
    total_shares = Column(Integer)
    price = Column(DECIMAL(18, 2), default=100.00)
    volatility_rating = Column(Float, default=1.0)
    is_halted = Column(Boolean, default=False)
    halted_until = Column(DateTime, nullable=True)
    circuit_breaker_level = Column(Integer, default=0) # 0, 1 (10%), 2 (15%), 3 (20%)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def current_price(self) -> float:
        return float(self.price) if self.price is not None else 0.0

    @current_price.setter
    def current_price(self, value):
        if value is None:
            raise ValueError("current_price cannot be None")
        self.price = Decimal(str(value))

    @property
    def opening_price(self) -> float:
        # Derived field exposed for schema compatibility; intentionally read-only.
        return float(self.price) if self.price is not None else 0.0


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    quantity = Column(Integer, default=0)
    average_buy_price = Column(DECIMAL(18, 2), default=0.00)

    team = relationship("Team", back_populates="holdings")
    company = relationship("Company")

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    type = Column(String) # "buy" or "sell"
    quantity = Column(Integer)
    price = Column(DECIMAL(18, 2))
    realized_profit = Column(DECIMAL(18, 2), nullable=True) # Only for sells
    timestamp = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="trades")
    company = relationship("Company")

class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    headline = Column(String)
    # Impact score: e.g. -0.10 for -10%
    impact_score = Column(Float) 
    sector_impacted = Column(String, nullable=True) # If None, specific company? Or store company_id?
    # For now, let's keep it simple: if company_id is null, it might be sector news if sector_impacted is set.
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    is_breaking = Column(Boolean, default=False)
    released_at = Column(DateTime, default=datetime.utcnow)
    
    # Hidden until bought logic? Or just generated on the fly?
    # Let's say "Scheduled" news exists in DB but with a future released_at.
    
class InsiderTip(Base):
    __tablename__ = "insider_tips"
    
    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id"))
    cost = Column(Float, default=5000.0)
    # This table might track *purchases* of tips, or definition of tips. 
    # Actually, let's track Purchases of tips in a separate table or just use logic.
    # Let's make this table "AvailableTips" effectively.
    

class TeamTipPurchase(Base):
    __tablename__ = "team_tip_purchases"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    news_id = Column(Integer, ForeignKey("news.id"))
    purchased_at = Column(DateTime, default=datetime.utcnow)

class TeamMember(Base):
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    user_email = Column(String, nullable=False)
    firebase_uid = Column(String, nullable=False)
    role = Column(String, default="member")  # 'owner' or 'member'
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    team = relationship("Team")

class TeamInvite(Base):
    __tablename__ = "team_invites"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    invite_code = Column(String, unique=True, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    max_uses = Column(Integer, default=1)
    uses = Column(Integer, default=0)
    
    team = relationship("Team")

class ScheduledEvent(Base):
    __tablename__ = "scheduled_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String) # 'price_move', 'news_drop', 'dividend'
    target_id = Column(Integer, nullable=True) # Company ID or Sector ID (if encoded as negative?)
    # or just use JSON for flexibility
    params = Column(String) # JSON string: {"pct_change": 0.05, "headline": "..."}
    execute_at = Column(DateTime, index=True)
    executed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LimitOrder(Base):
    __tablename__ = "limit_orders"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    type = Column(String) # "STOP_LOSS" or "TAKE_PROFIT"
    trigger_price = Column(DECIMAL(18, 2))
    quantity = Column(Integer)
    status = Column(String, default="PENDING") # PENDING, EXECUTED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team")
    company = relationship("Company")
