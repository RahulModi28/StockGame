import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def grant_admin(email):
    with engine.connect() as conn:
        # Check if user exists
        result = conn.execute(text(f"SELECT id, name FROM teams WHERE email = '{email}'"))
        row = result.fetchone()
        
        if not row:
            print(f"Error: User with email '{email}' not found.")
            return

        user_id, name = row
        print(f"Found User: {name} (ID: {user_id})")
        
        # Update
        conn.execute(text(f"UPDATE teams SET is_admin = true WHERE id = {user_id}"))
        conn.commit()
        print(f"SUCCESS: User '{name}' ({email}) is now an ADMIN.")

if __name__ == "__main__":
    grant_admin("rahul.modi@bbafmah.christuniversity.in")
