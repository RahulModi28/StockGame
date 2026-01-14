from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from app.database import SQLALCHEMY_DATABASE_URL
from app.models import Team

def grant_admin(email):
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        user = session.query(Team).filter(Team.email == email).first()
        if user:
            user.is_admin = True
            session.commit()
            print(f"Successfully granted admin rights to {email}")
        else:
            print(f"User with email {email} not found.")
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    # Correct email found in DB
    email = "rahul.modi@bbafmah.christuniversity.in"
    grant_admin(email)
