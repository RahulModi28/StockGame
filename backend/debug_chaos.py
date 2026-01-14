import sys
import os
import asyncio
sys.path.append(os.getcwd())

from app.services.market_maker import market_director
from app.database import get_redis_client

def debug_market():
    redis_client = get_redis_client()
    is_open = redis_client.get("market:is_open")
    print(f"DEBUG: Redis 'market:is_open' = {is_open} (Type: {type(is_open)})")
    
    # Check is_market_open method
    method_check = market_director.is_market_open()
    print(f"DEBUG: Internal is_market_open() check = {method_check}")
    
    if not method_check:
        print("WARNING: Market is perceived as CLOSED. Chaos will not trigger.")
    
    print("DEBUG: Attempting to manually trigger chaos...")
    try:
        market_director.trigger_random_chaos()
        print("SUCCESS: Manual chaos trigger completed without error.")
    except Exception as e:
        print(f"ERROR: Failed to trigger chaos: {e}")

if __name__ == "__main__":
    debug_market()
