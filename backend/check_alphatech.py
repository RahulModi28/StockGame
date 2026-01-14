import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def get_alphatech_data():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name, total_shares, volatility_rating FROM companies WHERE name = 'AlphaTech'"))
        row = result.fetchone()
        if row:
            print(f"Company: {row[0]}")
            print(f"Total Shares: {row[1]}")
            print(f"Volatility Rating: {row[2]}")
        else:
            print("AlphaTech not found.")

if __name__ == "__main__":
    get_alphatech_data()
