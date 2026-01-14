from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from .database import get_db
from .firebase_auth import verify_firebase_token
from . import models, crud

def get_current_user(token: dict = Depends(verify_firebase_token), db: Session = Depends(get_db)):
    # token is the decoded dict from verify_firebase_token
    email = token.get("email")
    if not email:
         raise HTTPException(status_code=401, detail="Invalid token: no email found")
    
    # Try finding by email
    # Check TeamMember first for cleaner logic if we had multi-team, but currently Team has email
    # We should look up the Team directly if 1:1 user:team mapping
    
    # Check if user is a member of any team
    membership = db.query(models.TeamMember).filter(models.TeamMember.user_email == email).first()
    if membership:
        team = db.query(models.Team).filter(models.Team.id == membership.team_id).first()
        if team: return team

    # Fallback to Team.email (legacy/simple)
    team = db.query(models.Team).filter(models.Team.email == email).first()
    if not team:
        # Create user? No, this is for protected routes, user must be logged in/registered.
        raise HTTPException(status_code=401, detail="User not registered")
        
    # Check if banned
    try:
        from .database import get_redis_client
        redis_client = get_redis_client()
        is_banned = redis_client.get(f"user:{team.id}:banned")
        if is_banned == '1':
             raise HTTPException(status_code=403, detail="Your account has been suspended by the administrator.")
    except ImportError:
        pass # access without redis check if circular import (should be fine)
        
    return team

def require_admin(current_user: models.Team = Depends(get_current_user)):
    if not current_user.is_admin:
        print(f"SECURITY ALERT: Unauthorized Admin Access Attempt by {current_user.email} (ID: {current_user.id})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user
