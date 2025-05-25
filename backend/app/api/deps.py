from typing import Generator, Optional
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError

from app import models, schemas
from app.core.config import settings
from app.core import security
from app.config.database import get_database
from app.services.fabric_service import FabricService

# File paths for Hyperledger Fabric
WALLET_PATH = os.environ.get('FABRIC_WALLET_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'wallet'))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/login/access-token")

# Make sure the wallet directory exists
os.makedirs(WALLET_PATH, exist_ok=True)
_fabric_service = FabricService(wallet_path=WALLET_PATH)

async def get_db():
    return get_database()

def get_fabric_service() -> FabricService:
    """
    Dependency for getting the Fabric service.
    """
    return _fabric_service

async def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = schemas.TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    db = get_database()
    
    # Check the user type from the token payload
    user_type = payload.get("user_type") 
    
    user = None
    if user_type == "employer":
        # For employer tokens, look in the employers collection
        # First try direct lookup with the token subject
        user = await db.employers.find_one({"_id": token_data.sub})
        
        # If not found and the token subject is a string, try with ObjectId conversion
        if not user and isinstance(token_data.sub, str):
            try:
                from bson import ObjectId
                object_id = ObjectId(token_data.sub)
                user = await db.employers.find_one({"_id": object_id})
            except Exception as e:
                # Log the error but continue with the flow
                print(f"Error converting employer ID to ObjectId: {e}")
    else:
        # Default to looking in the users collection
        user = await db.users.find_one({"_id": token_data.sub})
        
        # Try with ObjectId if string lookup fails
        if not user and isinstance(token_data.sub, str):
            try:
                from bson import ObjectId
                object_id = ObjectId(token_data.sub)
                user = await db.users.find_one({"_id": object_id})
            except Exception as e:
                # Log the error but continue with the flow
                print(f"Error converting user ID to ObjectId: {e}")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add the user_type to the returned user object
    user["type"] = user_type
    
    return user

async def get_current_active_user(
    current_user = Depends(get_current_user),
):
    if not current_user.get("is_active", False):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_active_superuser(
    current_user = Depends(get_current_user),
):
    if not current_user.get("is_superuser", False):
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user 