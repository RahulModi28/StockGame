import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def check_impact():
    capital = 100000.0
    print(f"--- Max Impact Analysis (Capital: ${capital:,.0f}) ---")
    print(f"{'Company':<15} {'Price':<10} {'Cap':<12} {'Max Buy':<10} {'Impact %':<10}")
    print("-" * 60)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name, price, total_shares, volatility_rating FROM companies"))
        rows = result.fetchall()
        
        # Sort by impact
        data = []
        for row in rows:
            name, price, shares, vol = row
            if price <= 0: continue
            
            max_shares = int(capital / price)
            ratio = max_shares / shares
            impact = ratio * vol * 100 # In percentage
            
            data.append({
                "name": name,
                "price": price,
                "shares": shares,
                "max_buy": max_shares,
                "impact": impact
            })
            
        # Sort desc by impact
        data.sort(key=lambda x: x["impact"], reverse=True)
        
        for d in data:
            print(f"{d['name']:<15} ${d['price']:<9.2f} {d['shares']:<12} {d['max_buy']:<10} {d['impact']:.2f}%")

if __name__ == "__main__":
    check_impact()
