import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def list_users():
    with engine.connect() as conn:
        print(f"{'ID':<5} {'Name':<20} {'Email':<30} {'Is Admin'}")
        print("-" * 70)
        
        result = conn.execute(text("SELECT id, name, email, is_admin FROM teams"))
        rows = result.fetchall()
        
        if not rows:
            print("No users found in database.")
        
        for row in rows:
            is_admin = "YES" if row[3] else "NO"
            print(f"{row[0]:<5} {row[1]:<20} {row[2]:<30} {is_admin}")

if __name__ == "__main__":
    list_users()
