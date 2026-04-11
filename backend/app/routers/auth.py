from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db
from ..firebase_auth import verify_firebase_token
from pydantic import BaseModel

router = APIRouter()

class FirebaseLoginRequest(BaseModel):
    id_token: str

@router.post("/login", response_model=schemas.Team)
def login(request: FirebaseLoginRequest, db: Session = Depends(get_db)):
    decoded_token = verify_firebase_token(f"Bearer {request.id_token}")
    email = decoded_token.get("email")
    uid = decoded_token.get("uid")
    name = decoded_token.get("name") or email.split("@")[0] # Default name if not present

    # Check if user is a member of any teams
    membership = db.query(models.TeamMember).filter(
        models.TeamMember.user_email == email
    ).first()
    
    if membership:
        # User is already a member of a team, return that team
        team = db.query(models.Team).filter(models.Team.id == membership.team_id).first()
        return team
    
    # User is not a member of any team, create a new one
    # Check if user exists (legacy check for backward compatibility)
    team = db.query(models.Team).filter(models.Team.email == email).first()
    
    if not team:
        # Create new team
        existing_name = crud.get_team_by_name(db, name)
        if existing_name:
            name = f"{name}_{uid[:4]}"
            
        team = models.Team(
            name=name,
            email=email,
            firebase_uid=uid,
            access_code="FIREBASE_AUTH", # Placeholder
            cash_balance=100000.0
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        
        # Add user as owner in team_members
        member = models.TeamMember(
            team_id=team.id,
            user_email=email,
            firebase_uid=uid,
            role="owner"
        )
        db.add(member)
        db.commit()
        
    return team
