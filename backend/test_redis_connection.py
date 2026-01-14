import os
from dotenv import load_dotenv
import redis

# Load env vars first
load_dotenv()

# We need to manually invoke the logic or import the module.
# Importing app.database will execute the module level code, but get_redis_client is what we want.
from app.database import get_redis_client

print("--- Starting Redis Connection Test ---")
try:
    client = get_redis_client()
    print("Obtained client.")
    
    # Check connection kwargs to see where it's connected
    connection_kwargs = client.connection_pool.connection_kwargs
    host = connection_kwargs.get('host')
    print(f"Connected to Host: {host}")
    
    # Test Set/Get
    print("Testing SET 'backend_test' -> 'ok'")
    client.set('backend_test', 'ok')
    
    val = client.get('backend_test')
    print(f"Testing GET 'backend_test' -> '{val}'")
    
    if "upstash" in str(host):
        print("VERIFICATION SUCCESSFUL: Connected to Upstash!")
    elif host == "localhost" or host == "127.0.0.1":
        print("VERIFICATION NOTICE: Connected to Localhost (Fallback active or intended?)")
    else:
        print(f"VERIFICATION NOTICE: Connected to {host}")

except Exception as e:
    print(f"VERIFICATION FAILED: {e}")
