
import psycopg2
import os

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/stockgame")

# Parse the URL to get connection parameters
url_parts = DATABASE_URL.replace("postgresql://", "").split("@")
user_pass = url_parts[0].split(":")
host_db = url_parts[1].split("/")

user = user_pass[0]
password = user_pass[1] if len(user_pass) > 1 else ""
host = host_db[0]
database = host_db[1]

# Connect to the database
try:
    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password
    )
    conn.autocommit = True
    cursor = conn.cursor()
    print("Connected to database")
except Exception as e:
    print(f"Failed to connect: {e}")
    exit(1)

# Add halted_until column
try:
    cursor.execute('ALTER TABLE companies ADD COLUMN halted_until TIMESTAMP')
    print("Added halted_until column")
except Exception as e:
    print(f"halted_until column check failed (might exist): {e}")

# Add circuit_breaker_level column
try:
    cursor.execute('ALTER TABLE companies ADD COLUMN circuit_breaker_level INTEGER DEFAULT 0')
    print("Added circuit_breaker_level column")
except Exception as e:
    print(f"circuit_breaker_level column check failed (might exist): {e}")

conn.close()
print("Migration completed!")
