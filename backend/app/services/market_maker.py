
import random
import json
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models, crud
from ..database import SessionLocal, get_redis_client

# ... imports

# ... imports

class MarketDirector:
    def __init__(self):
        self.running = False

    async def start_loop(self):
        self.running = True
        print("Market Director Service Started.")
        while self.running:
            try:
                # 1. Check Schedule
                await asyncio.to_thread(self.check_scheduled_events)
                await asyncio.to_thread(self.check_limit_orders)
                
                # 2. Market Logic (Chaos or Sector Override)
                # 2. Market Logic (Chaos or Sector Override)
                is_open = await asyncio.to_thread(self.is_market_open)
                if is_open:
                    # Run logic if Chaos is ON OR if we have Sector Overrides
                    start_time = datetime.utcnow()
                    await asyncio.to_thread(self.execute_dow_theory_move)
                    elapsed = (datetime.utcnow() - start_time).total_seconds()
                    if elapsed > 2.0:
                        print(f"WARNING: Market Move took {elapsed:.2f}s")
                    
            except Exception as e:
                print(f"Market Director Error: {e}")
                
            await asyncio.sleep(2) # Frequency adjusted to 2s (0.5Hz) per user request

    def is_market_open(self):
        try:
            redis_client = get_redis_client()
            val = redis_client.get("market:is_open")
            # Default to 0 (Closed) if not set, or ensure int conversion
            return val is not None and int(val) == 1
        except:
            return False

    def is_chaos_enabled(self):
        try:
            redis_client = get_redis_client()
            val = redis_client.get("market:chaos_enabled")
            return val is not None and int(val) == 1
        except:
            return False

    def check_scheduled_events(self):
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            events = db.query(models.ScheduledEvent).filter(
                models.ScheduledEvent.executed == False,
                models.ScheduledEvent.execute_at <= now
            ).all()
            
            for event in events:
                self.execute_event(db, event)
                
            db.commit()
        finally:
            db.close()

    def execute_event(self, db: Session, event: models.ScheduledEvent):
        # print(f"Executing Event: {event.event_type} - {event.params}")
        try:
            params = json.loads(event.params)
            
            if event.event_type == "price_move":
                company_id = event.target_id
                pct_change = params.get("pct_change", 0.0)
                
                company = crud.get_company(db, company_id)
                if company:
                    redis_client = get_redis_client()
                    
                    # Calculate Potential New Price
                    opening_price = float(company.price) # Cast Decimal to Float
                    # Ensure current_price is float (it should be from crud, but be safe)
                    curr_price = float(company.current_price)
                    potential_price = curr_price * (1 + pct_change)
                    
                    # Calculate Deviation
                    if opening_price > 0:
                        total_change_pct = (potential_price - opening_price) / opening_price
                    else:
                        total_change_pct = 0.0
                        
                    abs_change = abs(total_change_pct)
                    
                    # Fetch current CB Level
                    current_level = int(redis_client.get(f"company:{company.id}:cb_level") or 0)
                    
                    new_level = current_level
                    halt_duration = 0
                    halt_msg = ""
                    should_clamp = False
                    
                    # Validation & Clamping Logic (Strict Limits)
                    # Use slightly tighter bounds (0.0999) to catch floating point edge cases
                    
                    # Level 3: 20%
                    if abs_change >= 0.1999: # and current_level < 3 (Always check strict limit)
                         new_level = 3
                         halt_duration = 86400
                         halt_msg = f"TRADING HALT: {company.ticker} hits 20% limit! Market suspended."
                         should_clamp = True
                         clamp_limit = 0.20
                         
                    # Level 2: 15%
                    elif abs_change >= 0.1499:
                         new_level = 2
                         halt_duration = 300
                         halt_msg = f"TRADING HALT: {company.ticker} spikes 15%. Paused for 5 min."
                         should_clamp = True
                         clamp_limit = 0.15
                         
                    # Level 1: 10%
                    elif abs_change >= 0.0999:
                         new_level = 1
                         halt_duration = 300
                         halt_msg = f"TRADING HALT: {company.ticker} moves 10%. Circuit breaker tripped."
                         should_clamp = True
                         clamp_limit = 0.10
                    
                    # If we need to clamp, reset potential_price
                    if should_clamp:
                        direction = 1 if total_change_pct > 0 else -1
                        potential_price = opening_price * (1 + (direction * clamp_limit))
                        
                        # Only trigger Hall logic if we are upgrading level (or if we are just hitting the wall repeatedly?)
                        # Logic: If already halted, we shouldn't be here (loop check). 
                        # If active trading hits limit -> Halt.
                        if new_level > current_level:
                            halt_until = datetime.utcnow() + timedelta(seconds=halt_duration)
                            redis_client.set(f"company:{company.id}:halted_until", halt_until.timestamp())
                            redis_client.set(f"company:{company.id}:cb_level", new_level)
                            redis_client.set(f"company:{company.id}:halt", 1)
                            
                            print(f"!!! CIRCUIT BREAKER {new_level} TRIPPED FOR {company.ticker} !!!")
                            
                            # Post Halt News
                            halt_news = models.News(
                                headline=halt_msg,
                                impact_score=0,
                                is_breaking=True,
                                company_id=company.id,
                                released_at=crud.get_game_time(redis_client)
                            )
                            db.add(halt_news)
                    
                    # Commit Final Price (Clamped or Normal)
                    company.current_price = potential_price
                    redis_client.set(f"company:{company.id}:price", potential_price)
                    
                    # Log History with VIRTUAL TIME
                    game_time = crud.get_game_time(redis_client)
                    crud.log_price_history(company.id, potential_price, custom_timestamp=game_time)
                    crud.update_ohlc_candle(company.id, potential_price)
                    
                    if not params.get("silent", False) and not should_clamp: # Don't spam movement news if clamped/halted
                        # Create News
                        headline = params.get("headline", f"{company.name} moves significantly!")
                        news = models.News(
                            headline=headline,
                            impact_score=pct_change,
                            is_breaking=True,
                            company_id=company.id,
                            released_at=datetime.utcnow()
                        )
                        db.add(news)
                        
                        print(f"!!! CIRCUIT BREAKER {new_level} TRIPPED FOR {company.ticker} !!!")
                        
                        # Post Halt News
                        halt_news = models.News(
                            headline=halt_msg,
                            impact_score=0, # Neutral info, but scary
                            is_breaking=True,
                            company_id=company.id,
                            released_at=datetime.utcnow()
                        )
                        db.add(halt_news)
                    # -----------------------------
                    
            event.executed = True
            
        except Exception as e:
            print(f"Failed to execute event {event.id}: {e}")

    def update_market_cycle(self):
        """
        Updates the Global Trend and Market Phase in Redis.
        Cycles: Accumulation -> Public Participation -> Excess -> Distribution -> Panic -> Despair -> Accumulation
        """
        redis_client = get_redis_client()
        
        # Get Current State
        try:
            current_trend = redis_client.get("market:trend") or "SIDEWAYS"
            current_phase = redis_client.get("market:phase") or "ACCUMULATION"
            
            # Simple state machine for Demo purposes (Cycles every ~12 ticks/1 minute if called frequently)
            # Realistically this should be much slower or event driven
            
            # 1% chance to switch MAJOR Trend (Bull <-> Bear) per tick
            if random.random() < 0.01:
                new_trend = "BEAR" if current_trend == "BULL" else "BULL"
                redis_client.set("market:trend", new_trend)
                print(f"*** MARKET TREND SHIFT: {new_trend} ***")
                
            # 5% chance to switch PHASE within Trend
            if random.random() < 0.05:
                # Phases: ACCUMULATION -> PARTICIPATION -> EXCESS
                phases = ["ACCUMULATION", "PARTICIPATION", "EXCESS"]
                curr_idx = phases.index(current_phase) if current_phase in phases else 0
                next_idx = (curr_idx + 1) % len(phases)
                new_phase = phases[next_idx]
                redis_client.set("market:phase", new_phase)
                print(f"*** MARKET PHASE SHIFT: {new_phase} ***")
                
        except Exception as e:
            print(f"Cycle Update Error: {e}")

    def execute_dow_theory_move(self):
        """
        Calculates price movements based on Dow Theory + Sector Overrides:
        Price Change = Base_Vol * (Trend_Bias + Phase_Mult + Sector_Bias + Noise)
        """
        db = SessionLocal()
        try:
            self.update_market_cycle()
            
            redis_client = get_redis_client()
            chaos_enabled = self.is_chaos_enabled()
            
            global_trend = redis_client.get("market:trend") or "SIDEWAYS"
            global_phase = redis_client.get("market:phase") or "ACCUMULATION"
            
            companies = crud.get_companies(db)
            if not companies: return

            # Group companies by sector to find leaders
            sector_groups = {}
            for c in companies:
                if c.sector not in sector_groups: sector_groups[c.sector] = []
                sector_groups[c.sector].append(c)
                
            # Sort each group by market cap (Price * TotalShares) descending
            leaders = {}
            for sector, stock_list in sector_groups.items():
                # Assuming total_shares is static in DB
                stock_list.sort(key=lambda x: x.price * x.total_shares, reverse=True)
                if stock_list:
                    leaders[stock_list[0].id] = True # Mark the leader

            # 1. Resolve Active Biases for ALL Sectors First (Pre-calculation)
            all_sectors = ["Technology", "Finance", "Consumer", "Automotive", "Healthcare"]
            
            # Correlation Matrix (Symmetric)
            # Tech  Fin   Cons  Auto  Health
            # 1.0   0.62  0.74  0.78  0.41 (Tech)
            # 0.62  1.0   0.69  0.65  0.38 (Fin)
            # 0.74  0.69  1.0   0.82  0.44 (Cons)
            # 0.78  0.65  0.82  1.0   0.36 (Auto)
            # 0.41  0.38  0.44  0.36  1.0  (Health)
            
            correlations = {
                "Technology": {"Finance": 0.62, "Consumer": 0.74, "Automotive": 0.78, "Healthcare": 0.41},
                "Finance":    {"Technology": 0.62, "Consumer": 0.69, "Automotive": 0.65, "Healthcare": 0.38},
                "Consumer":   {"Technology": 0.74, "Finance": 0.69, "Automotive": 0.82, "Healthcare": 0.44},
                "Automotive": {"Technology": 0.78, "Finance": 0.65, "Consumer": 0.82, "Healthcare": 0.36},
                "Healthcare": {"Technology": 0.41, "Finance": 0.38, "Consumer": 0.44, "Automotive": 0.36}
            }
            
            sector_raw_biases = {}
            sector_active_state = {} # To store if a sector is active or merely following
            
            for s in all_sectors:
                trend = redis_client.get(f"market:sector:{s}:trend")
                bias = 0.0
                active = False
                
                if trend:
                    active = True
                    if trend == "BULL": bias = 0.0010
                    elif trend == "BEAR": bias = -0.0010
                    elif trend == "SIDEWAYS": bias = 0.0 # Bias 0, but we need to handle noise later
                elif chaos_enabled:
                    # Fallback to global if active
                    if global_trend == "BULL": bias = 0.002
                    elif global_trend == "BEAR": bias = -0.002
                
                sector_raw_biases[s] = bias
                sector_active_state[s] = active or chaos_enabled

            # 2. Iterate Companies
            for company in companies:
                # Halt Check
                is_halted = redis_client.get(f"company:{company.id}:halt")
                if is_halted and int(is_halted) == 1:
                    halted_until = redis_client.get(f"company:{company.id}:halted_until")
                    if halted_until and float(halted_until) > datetime.utcnow().timestamp():
                        continue
                    else:
                        redis_client.delete(f"company:{company.id}:halt")
                        redis_client.delete(f"company:{company.id}:halted_until")

                # Determine Net Sector Trend Bias
                my_sector = company.sector
                my_raw_bias = sector_raw_biases.get(my_sector, 0.0)
                
                # Calculate Weighted Influence from Correlated Sectors
                weighted_sum = my_raw_bias * 1.0 # Self weight
                total_weight = 1.0
                
                # Only apply correlation if there is actual activity in other sectors
                # Or should correlation always apply? 
                # If Tech is Neutral (0) and Auto is Bear (-1), Tech should drop. Yes.
                
                if my_sector in correlations:
                    for neighbor, corr_factor in correlations[my_sector].items():
                        neighbor_bias = sector_raw_biases.get(neighbor, 0.0)
                        # We only want neighbors to influence if they have a NON-ZERO bias?
                        # No, if Neighbor is Neutral (0) and I am Bull (1), Neighbor drags me down? 
                        # That implies "Market Breadth". Yes, that's realistic.
                        weighted_sum += neighbor_bias * corr_factor
                        total_weight += corr_factor
                
                # Net Bias (Normalized)
                net_sector_bias = weighted_sum / total_weight
                
                # Base Phase Multiplier
                # If ANY sector is active or Chaos is on, we should allow movement
                # But if market is sleep, phase_mult is small?
                # Let's say: If Sector Active -> 1.0. Else -> Check Chaos.
                
                company_phase_mult = 1.0 if sector_active_state.get(my_sector) else 0.1
                if chaos_enabled:
                     if global_phase == "ACCUMULATION": company_phase_mult = 0.5
                     elif global_phase == "PARTICIPATION": company_phase_mult = 1.0
                     elif global_phase == "EXCESS": company_phase_mult = 2.5
                elif sector_active_state.get(my_sector):
                     company_phase_mult = 1.0 # Full volatility for targeted sector moves

                # Resolve Sideways NOISE Override
                # If my sector is explicitly SIDEWAYS, we want high volatility but 0 bias.
                # The net_sector_bias might be non-zero due to correlations!
                # If "Sideways" is clicked, does it enforce pure sideways (ignoring friends) or Correlated Sideways?
                # Users usually expect "I clicked Sideways, it goes sideways".
                # But "Healthcare Sideways" while "Tech Crashes" -> Healthcare might dip.
                # Let's keep the correlation drift, it's cool.
                
                # Check specific sideways flag for noise scaling
                my_trend = redis_client.get(f"market:sector:{my_sector}:trend")
                
                # Leader Logic
                sector_beta = 1.0
                if company.id in leaders:
                    sector_beta = 1.1
                else:
                    sector_beta = 0.85

                # 4. Calculate Move
                noise = random.uniform(-0.003, 0.003)
                
                if my_trend == "SIDEWAYS":
                     noise = random.uniform(-0.01, 0.01) # 1% range
                     # If explicitly sideways, maybe dampen the correlated bias slightly?
                     net_sector_bias = net_sector_bias * 0.5 
                
                pct_change = (net_sector_bias + noise) * company_phase_mult * sector_beta * company.volatility_rating
                
                # Apply Move
                event = models.ScheduledEvent(
                    event_type="price_move",
                    target_id=company.id,
                    params=json.dumps({
                        "pct_change": pct_change,
                        "headline": "Market Action",
                        "silent": True
                    }),
                    execute_at=datetime.utcnow()
                )
                db.add(event)
            
            db.commit()
            print(f"Dow Theory Move Executed. Global Chaos: {chaos_enabled}")
            
        finally:
            db.close()

    def schedule_event(self, db: Session, event_type: str, target_id: int, params: dict, delay_seconds: int):
        execute_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
        event = models.ScheduledEvent(
            event_type=event_type,
            target_id=target_id,
            params=json.dumps(params),
            execute_at=execute_at
        )
        db.add(event)
        # Caller commits
        return event

    def check_limit_orders(self):
        db = SessionLocal()
        try:
            active_orders = crud.get_all_active_orders(db)
            if not active_orders: return
            
            # Fetch current prices 
            companies = crud.get_companies(db)
            price_map = {c.id: c.current_price for c in companies}
            
            for order in active_orders:
                current_price = price_map.get(order.company_id)
                if not current_price: continue
                
                triggered = False
                
                # STOP LOSS: Sell if Price <= Trigger
                if order.type == "STOP_LOSS" and current_price <= order.trigger_price:
                    triggered = True
                # TAKE PROFIT: Sell if Price >= Trigger
                elif order.type == "TAKE_PROFIT" and current_price >= order.trigger_price:
                    triggered = True
                    
                if triggered:
                    print(f"Triggering {order.type} for Team {order.team_id} at ${current_price}")
                    try:
                        # Convert to Market Trade
                        # We use router logic, but we need to be careful about circular imports or context.
                        # It's safer to use crud directly but we need transaction logic (balance update etc).
                        # Let's import the router function or replicate logic? 
                        # Replicating logic here is cleaner for "System Execution"
                        
                        team = crud.get_team(db, order.team_id)
                        holding = crud.get_holding(db, order.team_id, order.company_id)
                        
                        # Validate holding exists
                        if not holding or holding.quantity < order.quantity:
                            # Cancel order if invalid? or partial fill?
                            # For now, Cancel.
                            order.status = "CANCELLED"
                            print(f"Order {order.id} cancelled: Insufficient shares")
                        else:
                            # Execute SELL
                            transaction_val = float(current_price) * order.quantity
                            team.cash_balance = float(team.cash_balance) + transaction_val
                            
                            holding.quantity -= order.quantity
                            if holding.quantity == 0:
                                db.delete(holding)
                                
                            # PnL
                            avg_buy = float(holding.average_buy_price)
                            realized = (float(current_price) - avg_buy) * order.quantity
                            
                            # Record Trade
                            db_trade = models.Trade(
                                team_id=team.id,
                                company_id=order.company_id,
                                type="sell",
                                quantity=order.quantity,
                                price=current_price,
                                realized_profit=realized,
                                timestamp=datetime.utcnow()
                            )
                            db.add(db_trade)
                            
                            # Mark Order Complete
                            order.status = "EXECUTED"
                            
                            # OCO Logic: Cancel other pending orders for this company/team
                            # This ensures if TP hits, SL is cancelled (and vice versa)
                            sibling_orders = db.query(models.LimitOrder).filter(
                                models.LimitOrder.team_id == order.team_id,
                                models.LimitOrder.company_id == order.company_id,
                                models.LimitOrder.status == "PENDING",
                                models.LimitOrder.id != order.id
                            ).all()
                            
                            for sibling in sibling_orders:
                                sibling.status = "CANCELLED"
                                print(f"OCO Trigger: Cancelled sibling order {sibling.id} (Type: {sibling.type})")
                            
                            # Notify? (Create News/Notification in DB)
                            msg = f"ORDER FILLED: {order.type} executed for {order.quantity} shares of {companies[order.company_id-1].ticker} at ${current_price:.2f}"
                            # Insert into some notification table if it existed, or system log
                        
                        db.commit()
                        
                    except Exception as e:
                        print(f"Order Execution Failed: {e}")
                        db.rollback()
                        
        finally:
            db.close()

market_director = MarketDirector()
