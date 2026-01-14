from sqlalchemy import create_engine, text
import os
import sys

# Add parent dir to path to import database config if needed, 
# but for this script we can just grab the URL or import it.
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from app.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Checking for is_admin column...")
        try:
            # Check if column exists
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='teams' AND column_name='is_admin';"))
            if result.fetchone():
                print("Column 'is_admin' already exists.")
            else:
                print("Adding 'is_admin' column...")
                conn.execute(text("ALTER TABLE teams ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;"))
                conn.commit()
                print("Column added successfully.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
