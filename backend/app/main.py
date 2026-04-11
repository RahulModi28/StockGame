import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, market, admin, news, portfolio, teams, orders
from .services.market_maker import market_director

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Market Simulation Game")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(market.router, prefix="/market", tags=["Market"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(news.router, prefix="/news", tags=["News"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])
app.include_router(teams.router, prefix="/teams", tags=["Teams"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])

@app.on_event("startup")
async def startup_event():
    # Start Market Director Loop in background
    asyncio.create_task(market_director.start_loop())

@app.get("/")
def read_root():
    return {"message": "Welcome to the Stock Market Simulation Game API"}
