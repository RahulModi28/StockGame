from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# Team Schames
class TeamBase(BaseModel):
    name: str

class TeamCreate(TeamBase):
    access_code: str

class Team(TeamBase):
    id: int
    email: Optional[str] = None
    cash_balance: float
    is_admin: bool = False
    model_config = ConfigDict(from_attributes=True)

# Company Schemas
class CompanyBase(BaseModel):
    name: str
    ticker: str
    sector: str
    current_price: float
    opening_price: float
    total_shares: int
    volatility_rating: float
    is_halted: bool
    halted_until: Optional[datetime] = None
    circuit_breaker_level: int = 0

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Trade Schemas
class TradeCreate(BaseModel):
    company_id: int
    quantity: int
    type: str # "buy" or "sell"

class Trade(BaseModel):
    id: int
    team_id: int
    company_id: int
    type: str
    quantity: int
    price: float
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Holding Schemas
class Holding(BaseModel):
    id: int
    company_id: int
    quantity: int
    average_buy_price: float
    company: Company # Nested company data
    
    model_config = ConfigDict(from_attributes=True)

# News Schemas
class NewsBase(BaseModel):
    headline: str
    impact_score: float
    is_breaking: bool
    sector_impacted: Optional[str] = None
    company_id: Optional[int] = None

class NewsCreate(NewsBase):
    pass

class News(NewsBase):
    id: int
    released_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Login
class LoginRequest(BaseModel):
    name: str
    access_code: str

# Admin Request Schemas
class VolatilityUpdate(BaseModel):
    volatility: float

class PriceOverride(BaseModel):
    company_id: int
    price: float

class MarketStatusUpdate(BaseModel):
    is_open: bool

class ChaosUpdate(BaseModel):
    enabled: bool

class SectorTrendUpdate(BaseModel):
    sector: str
    trend: str # "BULL", "BEAR", "SIDEWAYS"

class BalanceAdjustment(BaseModel):
    amount: float
    type: str # "CREDIT" or "DEBIT"

class BanRequest(BaseModel):
    is_banned: bool

class InsiderTipRequest(BaseModel):
    team_id: Optional[int] = None
    message: str

class MarketCycleUpdate(BaseModel):
    trend: Optional[str] = None
    phase: Optional[str] = None

# Limit Order Schemas
class LimitOrderBase(BaseModel):
    company_id: int
    type: str # "STOP_LOSS" or "TAKE_PROFIT"
    trigger_price: float
    quantity: int

class LimitOrderCreate(LimitOrderBase):
    pass

class LimitOrderUpdate(BaseModel):
    trigger_price: Optional[float] = None
    quantity: Optional[int] = None

class LimitOrder(LimitOrderBase):
    id: int
    team_id: int
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
