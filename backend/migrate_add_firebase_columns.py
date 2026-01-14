"""
Migration script to add email and firebase_uid columns to teams table (PostgreSQL)
"""
import psycopg2
import os

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/stockgame")

# Parse the URL to get connection parameters
# Format: postgresql://user:password@host/database
url_parts = DATABASE_URL.replace("postgresql://", "").split("@")
user_pass = url_parts[0].split(":")
host_db = url_parts[1].split("/")

user = user_pass[0]
password = user_pass[1] if len(user_pass) > 1 else ""
host = host_db[0]
database = host_db[1]

# Connect to the database
conn = psycopg2.connect(
    host=host,
    database=database,
    user=user,
    password=password
)
conn.autocommit = True
cursor = conn.cursor()

# Add email column
try:
    cursor.execute('ALTER TABLE teams ADD COLUMN email VARCHAR')
    print("Added email column")
except psycopg2.errors.DuplicateColumn as e:
    print(f"Email column already exists: {e}")
    conn.rollback()

# Add firebase_uid column
try:
    cursor.execute('ALTER TABLE teams ADD COLUMN firebase_uid VARCHAR')
    print("Added firebase_uid column")
except psycopg2.errors.DuplicateColumn as e:
    print(f"Firebase_uid column already exists: {e}")
    conn.rollback()

# Create indexes
try:
    cursor.execute('CREATE UNIQUE INDEX ix_teams_email ON teams (email)')
    print("Created email index")
except psycopg2.errors.DuplicateTable as e:
    print(f"Email index already exists: {e}")
    conn.rollback()

try:
    cursor.execute('CREATE UNIQUE INDEX ix_teams_firebase_uid ON teams (firebase_uid)')
    print("Created firebase_uid index")
except psycopg2.errors.DuplicateTable as e:
    print(f"Firebase_uid index already exists: {e}")
    conn.rollback()

conn.close()

print("Migration completed!")
