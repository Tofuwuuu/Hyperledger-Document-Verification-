from fastapi import Depends, HTTPException, status, Request, Header
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timedelta
from jose import JWTError, jwt
from bson.objectid import ObjectId
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
import logging
from pydantic import BaseModel

# Set up logging
logger = logging.getLogger(__name__)

from app.config.database import get_database
from app.models.user import User
import hashlib
from app.core.config import settings

# Define TokenData class
class TokenData(BaseModel):
    user_id: str

load_dotenv()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "please_change_this_to_a_secure_random_string_in_env_file")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{os.getenv('API_V1_STR', '/api/v1')}/auth/login")

def verify_password(plain_password, hashed_password):
    """Verify password against hash"""
    try:
        # Special case for SHA-256 hashed passwords
        if hashed_password.startswith('sha256$'):
            parts = hashed_password.split('$')
            if len(parts) != 3:
                return False
            
            salt = parts[1]
            hash_part = parts[2]
            password_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
            
            # Log the verification attempt for debugging
            logging.debug(f"Verifying SHA256 password: {hash_part == password_hash}")
            
            return hash_part == password_hash
            
        # Regular bcrypt verification
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        # Log the error for debugging
        logging.error(f"Password verification error: {str(e)}")
        return False

def get_password_hash(password):
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create refresh token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_admin_bypass_header(request: Request) -> Optional[str]:
    """Get admin bypass header from request if it exists"""
    return request.headers.get("X-Admin-Bypass")

def _is_admin_bypass_allowed(request: Optional[Request]) -> bool:
    if not request:
        return False
    if settings.ENV.lower() != "development":
        return False
    if not settings.ENABLE_ADMIN_BYPASS:
        return False
    # Optional shared secret to avoid accidental exposure even in dev
    if settings.ADMIN_BYPASS_SECRET:
        return request.headers.get("X-Admin-Bypass-Secret") == settings.ADMIN_BYPASS_SECRET
    return True

async def get_current_user(request: Request = None, authorization: str = Header(None), token: str = Depends(oauth2_scheme)):
    """
    Get current user from token
    
    This function will check from different sources in this order:
    1. Admin bypass header if present
    2. Authorization header (Bearer token)
    3. HttpOnly cookies
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check for admin bypass header and token format (dev-only, explicitly enabled)
    admin_bypass = False
    if request and authorization:
        admin_bypass_header = get_admin_bypass_header(request)
        scheme, param = get_authorization_scheme_param(authorization)
        
        if (
            _is_admin_bypass_allowed(request)
            and admin_bypass_header == "true"
            and scheme.lower() == "bearer"
            and param
            and param.startswith("admin_access_token_")
        ):
            logger.info(f"Admin bypass detected with token: {param[:20]}...")
            admin_bypass = True
    
    # Handle admin bypass by ensuring a persistent admin user exists
    if admin_bypass:
        logger.info("Handling admin bypass authentication")
        db = get_database()
        
        # Check if the admin bypass user already exists
        bypass_email = os.getenv("ADMIN_BYPASS_EMAIL", "admin.bypass@example.com")
        admin_user = await db.users.find_one({"email": bypass_email})
        
        if admin_user:
            logger.info(f"Found existing admin bypass user: {admin_user['_id']}")
            return admin_user
        else:
            # Create a persistent admin bypass user
            logger.info("Creating persistent admin bypass user in database")
            now = datetime.utcnow()
            admin_id = f"admin_bypass_{now.timestamp()}"
            
            # Prepare admin user data with strong defaults
            new_admin = {
                "_id": admin_id,
                "email": bypass_email,
                "full_name": "Admin Bypass User",
                "first_name": "Admin",
                "last_name": "Bypass",
                "hashed_password": get_password_hash(os.getenv("ADMIN_DEFAULT_PASSWORD", "ChangeThisPassword123")),
                "department": "IT Department",
                "position": "System Administrator",
                "is_active": True,
                "is_admin": True,
                "created_at": now,
                "updated_at": now
            }
            
            try:
                # Insert the admin user into the database
                await db.users.insert_one(new_admin)
                logger.info(f"Created admin bypass user with ID: {admin_id}")
                return new_admin
            except Exception as e:
                logger.error(f"Error creating admin bypass user: {str(e)}")
                # Fall back to in-memory mock admin if database insert fails
                mock_admin = {
                    "_id": admin_id,
                    "id": admin_id,
                    "email": bypass_email,
                    "full_name": "Admin Bypass User (Temporary)",
                    "is_active": True,
                    "is_admin": True,
                    "created_at": now,
                    "updated_at": now
                }
                return mock_admin
    
    # Try using Oauth2 token from Authorization header (backward compatibility)
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise credentials_exception
            token_data = TokenData(user_id=user_id)
        except JWTError:
            raise credentials_exception
    # Otherwise, try to get token from cookies
    elif request:
        cookies = request.cookies
        access_token = cookies.get("access_token")
        
        if access_token:
            # Remove "Bearer " prefix if present
            if access_token.startswith("Bearer "):
                access_token = access_token[7:]
                
            try:
                payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id: str = payload.get("sub")
                if user_id is None:
                    raise credentials_exception
                token_data = TokenData(user_id=user_id)
            except JWTError:
                raise credentials_exception
        else:
            raise credentials_exception
    else:
        raise credentials_exception
    
    try:
        db = get_database()
        user = await db.users.find_one({"_id": token_data.user_id})
        if user is None:
            raise credentials_exception
        
        # Convert _id to string
        user["_id"] = str(user["_id"])
        
        # Ensure is_verified is set to a boolean value
        if "is_verified" not in user or user["is_verified"] is None:
            user["is_verified"] = False
        
        # If database indicates user should be verified but the value isn't boolean True, fix it
        if user.get("is_verified") in ["true", "1", 1, "yes", "y"] and user["is_verified"] is not True:
            logger.info(f"Converting non-boolean verified value to True for user {user['_id']}")
            user["is_verified"] = True
            # Also update the database so this fix is permanent
            await db.users.update_one(
                {"_id": token_data.user_id},
                {"$set": {"is_verified": True}}
            )
        
        return user
    except Exception as e:
        logging.error(f"Error fetching user: {str(e)}")
        raise credentials_exception

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Check if user is active and return a User model object"""
    if current_user.get("is_active") is False:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Convert the ObjectId to string if it's not already
    if isinstance(current_user.get('_id'), ObjectId):
        current_user['_id'] = str(current_user.get('_id'))
    
    try:
        # Set default values for required fields if missing
        # This ensures model validation won't fail
        if 'first_name' not in current_user or not current_user['first_name']:
            current_user['first_name'] = "Unknown"
        
        if 'last_name' not in current_user or not current_user['last_name']:
            current_user['last_name'] = "User"
            
        if 'hashed_password' not in current_user:
            current_user['hashed_password'] = "placeholder_for_admin_bypass"
        
        # For Pydantic v2 compatibility, create a clean dictionary with only the fields needed
        user_data = {
            "_id": current_user.get("_id") or current_user.get("id"),
            "email": current_user.get("email", "admin@example.com"),
            "first_name": current_user.get("first_name", "Admin"),
            "last_name": current_user.get("last_name", "User"),
            "is_active": current_user.get("is_active", True),
            "is_admin": current_user.get("is_admin", False),
            "is_verified": current_user.get("is_verified", False),
            "hashed_password": current_user.get("hashed_password", "placeholder"),
            "created_at": current_user.get("created_at", datetime.utcnow()),
            "updated_at": current_user.get("updated_at", datetime.utcnow()),
            "student_id": current_user.get("student_id"),
            "year_graduated": current_user.get("year_graduated"),
            "department": current_user.get("department"),
            "course": current_user.get("course"),
            "profile_picture": current_user.get("profile_picture")
        }
            
        # Convert the dictionary to a User model object - with only expected fields
        user_model = User(**user_data)
        return user_model
    except Exception as e:
        logger.error(f"Error creating User model from dict: {e}")
        # If conversion fails, ensure the dictionary has id property for compatibility
        if '_id' in current_user and 'id' not in current_user:
            current_user['id'] = current_user['_id']
        return current_user

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_active_user)):
    """Check if user is admin"""
    # Check if current_user is a User model or a dictionary
    is_admin = False
    if isinstance(current_user, User):
        is_admin = current_user.is_admin
    else:
        is_admin = current_user.get("is_admin", False)
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Convert User model to dictionary if needed
    if not isinstance(current_user, dict):
        try:
            # First try to use the model's dict method
            user_dict = current_user.dict()
            
            # Ensure _id and id are present
            if '_id' not in user_dict and hasattr(current_user, 'id'):
                user_dict['_id'] = str(current_user.id)
            if 'id' not in user_dict and hasattr(current_user, '_id'):
                user_dict['id'] = str(current_user._id)
                
            return user_dict
        except AttributeError:
            # If dict() method not available, create dictionary manually
            return {
                "_id": str(getattr(current_user, "_id", getattr(current_user, "id", "unknown"))),
                "id": str(getattr(current_user, "id", getattr(current_user, "_id", "unknown"))),
                "email": getattr(current_user, "email", ""),
                "full_name": getattr(current_user, "full_name", ""),
                "first_name": getattr(current_user, "first_name", ""),
                "last_name": getattr(current_user, "last_name", ""),
                "is_active": getattr(current_user, "is_active", True),
                "is_admin": getattr(current_user, "is_admin", True),
                "is_verified": getattr(current_user, "is_verified", True),
                "student_id": getattr(current_user, "student_id", ""),
                "employee_id": getattr(current_user, "employee_id", ""),
                "department": getattr(current_user, "department", ""),
                "position": getattr(current_user, "position", ""),
                "phone": getattr(current_user, "phone", ""),
                "address": getattr(current_user, "address", ""),
                "bio": getattr(current_user, "bio", ""),
                "profile_picture": getattr(current_user, "profile_picture", "")
            }

    return current_user

async def get_current_user_ws(token: str):
    """
    Validate JWT token for WebSocket authentication.
    This is similar to get_current_user but modified for WebSocket usage.
    
    Args:
        token: JWT token from WebSocket query parameter
        
    Returns:
        User information from the database
        
    Raises:
        Exception: If authentication fails
    """
    try:
        # Verify and decode token
        payload = jwt.decode(
            token, 
            os.getenv("SECRET_KEY", "default_secret"), 
            algorithms=[os.getenv("ALGORITHM", "HS256")]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise Exception("Invalid authentication credentials")
        
        # Get user from database
        db = get_database()
        user = await db.users.find_one({"_id": user_id})
        if user is None:
            raise Exception("User not found")
        
        return user
        
    except JWTError:
        raise Exception("Invalid token")
    except Exception as e:
        raise Exception(f"Authentication failed: {str(e)}")

# Add this function to provide compatibility with the import in main.py
async def get_current_user_from_token(request: Request = None, authorization: str = Header(None)):
    """
    Get current user from token (compatibility wrapper for get_current_user)
    """
    return await get_current_user(request, authorization) 