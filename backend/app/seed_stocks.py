
import sys
import os

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, get_redis_client
from app import models
import random

def seed_data():
    db = SessionLocal()
    redis_client = get_redis_client()
    
    try:
        print("WARNING: This will wipe all existing game data.")
        print("Cleaning up database...")
        
        # 1. Clear Tables (Order matters due to foreign keys)
        # Delete trades first, then holdings, then news, then day_stats?, then companies
        db.query(models.Trade).delete()
        db.query(models.Holding).delete()
        db.query(models.News).delete()
        # db.query(models.Team).delete() # Keep teams/users for now so they don't lose accounts
        db.query(models.Company).delete()
        
        db.commit()
        print("Database cleared.")
        
        # 2. Define New Data
        sectors_data = {
            "Technology": [
                {"name": "AlphaTech", "price": 120.0, "cap": 9000000},
                {"name": "NexaSoft", "price": 85.0, "cap": 7500000},
                {"name": "CloudNova", "price": 210.0, "cap": 11000000},
                {"name": "QuantumByte", "price": 145.0, "cap": 8750000},
            ],
            "Finance": [
                {"name": "FinTrust", "price": 95.0, "cap": 7000000},
                {"name": "PayAxis", "price": 65.0, "cap": 5500000},
                {"name": "CapitalX", "price": 130.0, "cap": 8000000},
                {"name": "LedgerOne", "price": 78.0, "cap": 6250000},
            ],
            "Consumer": [
                {"name": "FreshMart", "price": 42.0, "cap": 4500000},
                {"name": "UrbanWear", "price": 58.0, "cap": 4750000},
                {"name": "SnapEats", "price": 74.0, "cap": 5750000},
                {"name": "HomeNest", "price": 66.0, "cap": 5250000},
            ],
            "Automotive": [
                {"name": "VoltAuto", "price": 155.0, "cap": 8250000},
                {"name": "DriveCore", "price": 98.0, "cap": 6500000},
                {"name": "TorqueMotors", "price": 72.0, "cap": 5500000},
                {"name": "EcoRide", "price": 54.0, "cap": 4750000},
            ],
            "Healthcare": [
                {"name": "MediCore", "price": 135.0, "cap": 8500000},
                {"name": "BioZen", "price": 72.0, "cap": 6000000},
                {"name": "HealthAxis", "price": 88.0, "cap": 6750000},
                {"name": "VitaLabs", "price": 115.0, "cap": 7750000},
            ]
        }
        
        print("Seeding new companies...")
        
        for sector, stocks in sectors_data.items():
            for stock in stocks:
                name = stock["name"]
                price = stock["price"]
                market_cap = stock["cap"]
                
                # Calculate Total Shares
                # Prevent division by zero if price is 0 (unlikely here)
                total_shares = int(market_cap / price) if price > 0 else 0
                
                # Generate Ticker (First 3-4 letters uppercase)
                ticker = name[:4].upper()
                # Ensure unique ticker if conflict (simple check, assume unique for this set)
                
                # Initialize Redis Data
                # Volatility: Random between 0.8 and 1.8 for variety
                volatility = round(random.uniform(0.8, 1.8), 2)

                # Create Company Object - Note: 'price' in model is 'price', schema has 'current_price'
                # Model definition matches DB columns
                company = models.Company(
                    name=name,
                    ticker=ticker,
                    sector=sector,
                    total_shares=total_shares,
                    price=price,
                    volatility_rating=volatility,
                    is_halted=False
                )
                db.add(company)
                db.commit() # Commit to get ID
                db.refresh(company)
                
                redis_client.set(f"company:{company.id}:price", price)
                redis_client.set(f"company:{company.id}:volatility", volatility)
                redis_client.set(f"company:{company.id}:halt", 0)
                
                print(f"Created {name} ({ticker}) - ${price}")
                
        print("Seed complete! 20 Companies created.")
        
        # Invalidate Static List Cache
        redis_client.delete("companies:static_list")
        print("Cache Invalidated.")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
