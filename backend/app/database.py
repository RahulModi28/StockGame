from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import redis
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
REMOTE_DATABASE_URL = os.getenv("REMOTE_DATABASE_URL")
LOCAL_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/stockgame")

SQLALCHEMY_DATABASE_URL = LOCAL_DATABASE_URL
engine = None

if REMOTE_DATABASE_URL:
    try:
        print(f"Attempting to connect to Remote Postgres...")
        # Create a temp engine to verify connection
        # Increased timeout to 30 seconds to handle potential network latency
        temp_engine = create_engine(REMOTE_DATABASE_URL, connect_args={"connect_timeout": 30})
        with temp_engine.connect() as connection:
            print("Successfully connected to Remote Postgres.")
        
        SQLALCHEMY_DATABASE_URL = REMOTE_DATABASE_URL
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True
        )
    except Exception as e:
        print(f"Failed to connect to Remote Postgres: {e}")
        print(f"Falling back to Local Postgres at {LOCAL_DATABASE_URL}...")
        engine = create_engine(
            LOCAL_DATABASE_URL,
            pool_size=20,
            max_overflow=30
        )
else:
    print(f"No Remote Postgres URL found. Using Local Postgres at {LOCAL_DATABASE_URL}...")
    engine = create_engine(
        LOCAL_DATABASE_URL,
        pool_size=20,
        max_overflow=30
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Redis Configuration
# Try Upstash first, then fallback to local Redis
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_REDIS_TOKEN = os.getenv("UPSTASH_REDIS_TOKEN")
LOCAL_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Create a single global client instance
redis_client = None

def get_redis_client():
    global redis_client
    if redis_client:
        return redis_client

    # Try Upstash
    if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_TOKEN:
        try:
            # Extract host from URL (remove https://)
            host = UPSTASH_REDIS_REST_URL.replace("https://", "")
            # Construct rediss:// URL for redis-py
            upstash_url = f"rediss://default:{UPSTASH_REDIS_TOKEN}@{host}:6379"
            
            print(f"Attempting to connect to Upstash Redis at {host}...")
            # Use strict timeouts for connection and socket operations
            client = redis.from_url(
                upstash_url, 
                decode_responses=True, 
                socket_timeout=3, 
                socket_connect_timeout=3
            )
            client.ping() # connection check
            print("Successfully connected to Upstash Redis.")
            redis_client = client
            return redis_client
        except Exception as e:
            print(f"Failed to connect to Upstash Redis: {e}")
            print("Falling back to local Redis...")

    # Fallback to Local
    print(f"Connecting to Local Redis at {LOCAL_REDIS_URL}...")
    try:
        client = redis.from_url(LOCAL_REDIS_URL, decode_responses=True)
        client.ping()
        print("Successfully connected to Local Redis.")
        redis_client = client
        return redis_client
    except Exception as e:
        print(f"CRITICAL: Failed to connect to Local Redis: {e}")
        raise e

