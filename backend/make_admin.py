import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def make_admin():
    target_email = sys.argv[1] if len(sys.argv) > 1 else None
    
    with engine.connect() as conn:
        if target_email:
             # Find specific user
             stmt = text("SELECT id, name, email FROM teams WHERE email = :email")
             result = conn.execute(stmt, {"email": target_email})
        else:
            # Fallback to first user
            print("No email provided. Defaulting to first user...")
            result = conn.execute(text("SELECT id, name, email FROM teams LIMIT 1"))
            
        row = result.fetchone()
        
        if not row:
            print(f"User not found{f' for email {target_email}' if target_email else ''}. Please Log In via the Frontend first.")
            return

        user_id, name, email = row
        print(f"Found User: {name} ({email})")
        
        # Update
        conn.execute(text(f"UPDATE teams SET is_admin = true WHERE id = {user_id}"))
        conn.commit()
        print(f"SUCCESS: User {name} is now an ADMIN.")

if __name__ == "__main__":
    make_admin()
