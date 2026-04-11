import certifi
import os
import logging
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, status, Header
from .settings import settings

logger = logging.getLogger(__name__)

# Initialize Firebase Admin
# Expecting serviceAccountKey.json in the backend root or env var
# User will need to provide this file.
cred_path = settings.google_application_credentials

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
else:
    logger.warning("Firebase service account key not found at %s. Auth will fail.", cred_path)

def verify_firebase_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication header format",
        )
    
    token = authorization.split("Bearer ")[1]
    
    try:
        decoded_token = auth.verify_id_token(token)
        email = decoded_token.get("email")
        
        # Domain Restriction Removed
        # if not email.endswith("christuniversity.in") and not email.endswith("kristujayanti.edu.in"):
        #      raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="Access restricted to Christ University email addresses."
        #     )
            
        return decoded_token
    except Exception:
        logger.exception("Firebase token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
