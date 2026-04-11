from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.routers.auth import FirebaseLoginRequest, login


def _make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    models.Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return testing_session_local()


def test_login_creates_team_and_owner_membership(monkeypatch):
    db = _make_session()
    try:
        monkeypatch.setattr(
            "app.routers.auth.verify_firebase_token",
            lambda _: {"email": "owner@example.com", "uid": "uid-1234", "name": "Owner"},
        )

        result = login(FirebaseLoginRequest(id_token="token"), db)

        assert result.email == "owner@example.com"
        assert result.name == "Owner"
        membership = (
            db.query(models.TeamMember)
            .filter(models.TeamMember.user_email == "owner@example.com")
            .first()
        )
        assert membership is not None
        assert membership.role == "owner"
    finally:
        db.close()


def test_login_returns_existing_membership_team(monkeypatch):
    db = _make_session()
    try:
        team = models.Team(
            name="TeamOne",
            email="member@example.com",
            firebase_uid="uid-team",
            access_code="FIREBASE_AUTH",
            cash_balance=100000.0,
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        db.add(
            models.TeamMember(
                team_id=team.id,
                user_email="member@example.com",
                firebase_uid="uid-member",
                role="member",
            )
        )
        db.commit()

        monkeypatch.setattr(
            "app.routers.auth.verify_firebase_token",
            lambda _: {"email": "member@example.com", "uid": "uid-member", "name": "Member"},
        )

        result = login(FirebaseLoginRequest(id_token="token"), db)
        assert result.id == team.id
        assert result.name == "TeamOne"
    finally:
        db.close()
