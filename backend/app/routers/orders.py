from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter()

@router.post("/create", response_model=schemas.LimitOrder)
def create_order(order: schemas.LimitOrderCreate, team_id: int, db: Session = Depends(get_db)):
    # Basic validation
    company = crud.get_company(db, order.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Check simple business logic (e.g., can't sell what you don't have)
    if order.type == "STOP_LOSS" or order.type == "TAKE_PROFIT":
        # These are usually sell orders for long positions
        # MVP: We assume these are SELL orders.
        # Future: Allow short selling / buy orders
        pass

    return crud.create_limit_order(db, order, team_id)

@router.get("/list", response_model=list[schemas.LimitOrder])
def list_orders(team_id: int, db: Session = Depends(get_db)):
    return crud.get_limit_orders(db, team_id)

@router.put("/{order_id}", response_model=schemas.LimitOrder)
def update_order(order_id: int, updates: schemas.LimitOrderUpdate, team_id: int, db: Session = Depends(get_db)):
    updated_order = crud.update_limit_order(db, order_id, team_id, updates)
    if not updated_order:
         raise HTTPException(status_code=404, detail="Order not found or cannot be modified")
    return updated_order

@router.delete("/{order_id}")
def cancel_order(order_id: int, team_id: int, db: Session = Depends(get_db)):
    print(f"Received cancel request for Order {order_id} from Team {team_id}")
    success = crud.delete_limit_order(db, order_id, team_id)
    if not success:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"status": "success", "message": "Order cancelled"}
