from sqlalchemy import text
from app.database import engine

def add_email_column():
    with engine.connect() as connection:
        try:
            # Check if column exists is hard in raw SQL cross-db, but for PG 'ADD COLUMN IF NOT EXISTS'
            # works in valid PG syntax (Postgres 9.6+)
            print("Attempting to add email column...")
            connection.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
            # Make it unique?
            # connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_teams_email ON teams (email);"))
            connection.commit()
            print("Successfully added 'email' column to 'teams' table.")
        except Exception as e:
            print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_email_column()
