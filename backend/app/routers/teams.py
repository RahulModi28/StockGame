from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional
import secrets
import string

from .. import models, schemas
from ..database import get_db
from ..firebase_auth import verify_firebase_token

router = APIRouter()

# Pydantic Models
class InviteCreate(BaseModel):
    max_uses: int = 1
    expires_in_days: int = 7

class InviteResponse(BaseModel):
    invite_code: str
    expires_at: Optional[datetime]
    max_uses: int
    uses: int

class JoinTeamRequest(BaseModel):
    invite_code: str

class TeamMemberResponse(BaseModel):
    user_email: str
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True

class TeamResponse(BaseModel):
    id: int
    name: str
    role: str  # User's role in this team
    
    class Config:
        from_attributes = True

def generate_invite_code() -> str:
    """Generate a random invite code like TRADE-ABC123"""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(chars) for _ in range(6))
    return f"TRADE-{code}"

@router.post("/invite", response_model=InviteResponse)
def create_invite(
    request: InviteCreate,
    team_id: int,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Create an invite code for a team (owner only)"""
    email = token.get("email")
    
    # Check if user is owner of this team
    membership = db.query(models.TeamMember).filter(
        and_(
            models.TeamMember.team_id == team_id,
            models.TeamMember.user_email == email,
            models.TeamMember.role == "owner"
        )
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team owners can create invites"
        )
    
    # Generate unique invite code
    invite_code = generate_invite_code()
    while db.query(models.TeamInvite).filter(models.TeamInvite.invite_code == invite_code).first():
        invite_code = generate_invite_code()
    
    # Create invite
    expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
    invite = models.TeamInvite(
        team_id=team_id,
        invite_code=invite_code,
        created_by=email,
        expires_at=expires_at,
        max_uses=request.max_uses,
        uses=0
    )
    
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    return invite

@router.post("/join/{invite_code}", response_model=schemas.Team)
def join_team(
    invite_code: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Join a team using an invite code"""
    email = token.get("email")
    uid = token.get("uid")
    
    # Find invite
    invite = db.query(models.TeamInvite).filter(
        models.TeamInvite.invite_code == invite_code
    ).first()
    
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code"
        )
    
    # Check if expired
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code has expired"
        )
    
    # Check if max uses reached
    if invite.uses >= invite.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code has reached maximum uses"
        )
    
    # Check if already a member
    existing = db.query(models.TeamMember).filter(
        and_(
            models.TeamMember.team_id == invite.team_id,
            models.TeamMember.user_email == email
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this team"
        )
    
    # Add user to team
    member = models.TeamMember(
        team_id=invite.team_id,
        user_email=email,
        firebase_uid=uid,
        role="member"
    )
    
    db.add(member)
    
    # Increment invite uses
    invite.uses += 1
    
    db.commit()
    
    # Return the team
    team = db.query(models.Team).filter(models.Team.id == invite.team_id).first()
    return team

@router.get("/my-teams", response_model=List[TeamResponse])
def get_my_teams(
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all teams the user belongs to"""
    email = token.get("email")
    
    memberships = db.query(models.TeamMember).filter(
        models.TeamMember.user_email == email
    ).all()
    
    teams = []
    for membership in memberships:
        team = db.query(models.Team).filter(models.Team.id == membership.team_id).first()
        if team:
            teams.append({
                "id": team.id,
                "name": team.name,
                "role": membership.role
            })
    
    return teams

@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
def get_team_members(
    team_id: int,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all members of a team"""
    email = token.get("email")
    
    # Check if user is a member of this team
    membership = db.query(models.TeamMember).filter(
        and_(
            models.TeamMember.team_id == team_id,
            models.TeamMember.user_email == email
        )
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    
    # Get all members
    members = db.query(models.TeamMember).filter(
        models.TeamMember.team_id == team_id
    ).all()
    
    return members

@router.delete("/{team_id}/members/{member_email}")
def remove_member(
    team_id: int,
    member_email: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Remove a member from the team (owner only)"""
    email = token.get("email")
    
    # Check if user is owner
    membership = db.query(models.TeamMember).filter(
        and_(
            models.TeamMember.team_id == team_id,
            models.TeamMember.user_email == email,
            models.TeamMember.role == "owner"
        )
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team owners can remove members"
        )
    
    # Can't remove yourself if you're the owner
    if member_email == email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself as owner"
        )
    
    # Find and remove member
    member = db.query(models.TeamMember).filter(
        and_(
            models.TeamMember.team_id == team_id,
            models.TeamMember.user_email == member_email
        )
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Member removed successfully"}
