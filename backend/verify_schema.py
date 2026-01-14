import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def check_schema():
    with engine.connect() as conn:
        try:
            # Query for the column in postgres information_schema
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'volatility_rating'"))
            row = result.fetchone()
            if row:
                print("SUCCESS: 'volatility_rating' column exists.")
            else:
                print("FAILURE: 'volatility_rating' column NOT found.")
                
            # Check data
            result = conn.execute(text("SELECT name, volatility_rating FROM companies LIMIT 5"))
            for row in result:
                print(f"Company: {row[0]}, Volatility: {row[1]}")
                
        except Exception as e:
            print(f"Error checking schema: {e}")

if __name__ == "__main__":
    check_schema()
