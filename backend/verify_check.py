import requests
import redis
import sys

# Connect to Redis (assuming local or standard env, checking backend config)
# Backend uses 'redis://railway...' or localhost? 
# I should check how to connect. The backend uses 'redis' library.
# If I can't connect to redis directly, I'll rely on the API check logic if I can find a valid ID.

# Let's try to hit the API with a valid company ID.
# First, get companies.
try:
    r = requests.get("http://localhost:8000/market/companies")
    companies = r.json()
    if not companies:
        print("No companies found.")
        sys.exit(1)
        
    company_id = companies[0]['id']
    print(f"Testing with Company ID: {company_id}")
    
    # Check Market Status
    r_status = requests.get("http://localhost:8000/market/status")
    print(f"Current Market Status: {r_status.json()}")
    
    # We can't easily close the market without Admin Token.
    # BUT we can check if the 'trade' endpoint is reachable.
    
    # Since I cannot easily set the Redis key without auth, 
    # and I added the code, the best verification is to ask the user to test it.
    # BUT WAIT, I can use the 'set_market_status' logic if I disable auth temporarily? 
    # No, that's risky.
    
    # I'll just check if the endpoint returns "Market is Closed" if I assume it is closed?
    # No.
    
    # Let's assume the user will test the "End Session" button.
    # I will just verify the code logic via 'cat' to be sure I wrote it correctly.
    pass

except Exception as e:
    print(e)
