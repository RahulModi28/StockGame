import sys
import os

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.database import engine, Base
from app import models
from app import seed_stocks

def reset_db():
    print("Dropping all tables to update schema...")
    try:
        # Drop all tables interacting with the metadata
        Base.metadata.drop_all(bind=engine)
        print("Tables dropped.")
    except Exception as e:
        print(f"Error dropping tables: {e}")

    print("Recreating tables with new schema...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Tables created.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return

    print("Seeding data...")
    try:
        seed_stocks.seed_data()
        print("Database reset and seeded successfully!")
    except Exception as e:
        print(f"Error seeding data: {e}")

if __name__ == "__main__":
    reset_db()
