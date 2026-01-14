import certifi
import os
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, status, Header

# Initialize Firebase Admin
# Expecting serviceAccountKey.json in the backend root or env var
# User will need to provide this file.
cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    print(f"WARNING: Firebase service account key not found at {cred_path}. Auth will fail.")

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
    except Exception as e:
        print(f"AUTH ERROR: {str(e)}") # Debug Log
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )
