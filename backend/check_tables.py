
import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/stockgame")

url_parts = DATABASE_URL.replace("postgresql://", "").split("@")
user_pass = url_parts[0].split(":")
host_db = url_parts[1].split("/")

user = user_pass[0]
password = user_pass[1] if len(user_pass) > 1 else ""
host = host_db[0]
database = host_db[1]

conn = psycopg2.connect(
    host=host,
    database=database,
    user=user,
    password=password
)
cursor = conn.cursor()

cursor.execute("SELECT to_regclass('public.team_members');")
exists = cursor.fetchone()[0]

print(f"Table team_members exists: {exists is not None}")

conn.close()
