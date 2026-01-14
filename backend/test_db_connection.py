from sqlalchemy import text
from app.database import engine

print("--- Starting Postgres Connection Test ---")

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print(f"Query Result: {result.fetchone()}")
        
        url_str = str(engine.url)
        print(f"Connected URL Host: {engine.url.host}")
        
        if "neon.tech" in str(engine.url) or "aws" in str(engine.url):
             print("VERIFICATION SUCCESSFUL: Connected to Remote Neon Postgres!")
        elif "localhost" in str(engine.url) or "127.0.0.1" in str(engine.url):
             print("VERIFICATION NOTICE: Connected to Local Postgres (Fallback active?)")
        else:
             print(f"Connected to: {engine.url}")

except Exception as e:
    print(f"VERIFICATION FAILED: {e}")
