import sys
import os

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from backend.app import crud, models, schemas, database
from backend.app.routers import admin
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup DB
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost/stockgame"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_whale_alert():
    db = TestingSessionLocal()
    try:
        # Create dummy data if needed, or just query
        # We need a trade > 20000
        
        # Check if we have teams
        teams = crud.get_all_teams(db)
        if not teams:
            print("No teams found. Cannot verify.")
            return

        # Check for whale alerts
        print("Calling get_whale_alert...")
        # admin.get_whale_alert expects 'db' dependency
        whales = admin.get_whale_alert(threshold=1.0, db=db) # Low threshold to find ANY trade
        
        print(f"Found {len(whales)} alerts.")
        for w in whales:
            print(f"Time: {w['time']}, User: {w['user']}, Value: {w['value']}")
            if w['user'] == "Unknown Team" or w['user'] is None:
                print("FAILURE: User is Unknown/None!")
            else:
                print("SUCCESS: User loaded correctly.")
                
    finally:
        db.close()

if __name__ == "__main__":
    test_whale_alert()
