import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config.database import get_database
from app.models.user import User
from bson import ObjectId

load_dotenv()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "cvsu_carmona_alumni_blockchain_secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{os.getenv('API_V1_STR', '/api/v1')}/auth/login")

def verify_password(plain_password, hashed_password):
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, subject=None, user_type=None):
    """Create access token"""
    to_encode = data.copy() if data else {}
    
    # Support both legacy and new calling patterns
    if subject and "sub" not in to_encode:
        to_encode["sub"] = subject
    
    if user_type and "user_type" not in to_encode:
        to_encode["user_type"] = user_type
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Ensure we have a type field for access token
    if "type" not in to_encode:
        to_encode.update({"type": "access"})
    
    # Add expiration
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict = None, subject=None, user_type=None):
    """Create refresh token"""
    to_encode = data.copy() if data else {}
    
    # Support both legacy and new calling patterns
    if subject and "sub" not in to_encode:
        to_encode["sub"] = subject
    
    if user_type and "user_type" not in to_encode:
        to_encode["user_type"] = user_type
    
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Ensure we have a type field for refresh token
    if "type" not in to_encode:
        to_encode.update({"type": "refresh"})
    
    # Add expiration
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "")
        user_type: str = payload.get("user_type", "")  # Get user_type from token if available
        
        if user_id is None or token_type != "access":
            raise credentials_exception
        
        # Get user from database
        db = get_database()
        user = None
        
        # Check if this is an employer token
        if user_type == "employer":
            # For employer tokens, look in the employers collection
            user = await db.employers.find_one({"_id": user_id})
            if not user:
                # Try with ObjectId conversion if string ID lookup fails
                try:
                    user = await db.employers.find_one({"_id": ObjectId(user_id)})
                except:
                    pass
            
            # Add employer type if found
            if user:
                user["user_type"] = "employer"
                user["type"] = "employer"  # Keep for backward compatibility
        else:
            # Default to looking in the users collection
            user = await db.users.find_one({"_id": user_id})
            if not user:
                # Try employers collection as fallback
                try:
                    user = await db.employers.find_one({"_id": user_id})
                    if user:
                        user["user_type"] = "employer"
                        user["type"] = "employer"  # Keep for backward compatibility
                except:
                    pass
        
        if user is None:
            raise credentials_exception
            
        # Set the user_type if it wasn't set yet
        if "user_type" not in user:
            if user.get("is_admin"):
                user["user_type"] = "admin"
            elif user.get("is_staff"):
                user["user_type"] = "staff"
            else:
                user["user_type"] = "alumni"
        
        # Return user data
        return user
    except JWTError:
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
        
        # Convert the dictionary to a User model object
        user_model = User(**current_user)
        return user_model
    except Exception as e:
        print(f"Error creating User model from dict: {e}")
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
        user_type: str = payload.get("user_type", "")
        
        if user_id is None:
            raise Exception("Invalid authentication credentials")
        
        # Get user from database
        db = get_database()
        user = None
        
        # Check if this is an employer token
        if user_type == "employer":
            # For employer tokens, look in the employers collection
            user = await db.employers.find_one({"_id": user_id})
            if not user:
                # Try with ObjectId conversion if string ID lookup fails
                try:
                    user = await db.employers.find_one({"_id": ObjectId(user_id)})
                except:
                    pass
            
            # Add employer type if found
            if user:
                user["type"] = "employer"
        else:
            # Default to looking in the users collection
            user = await db.users.find_one({"_id": user_id})
            if not user:
                # Try employers collection as fallback
                try:
                    user = await db.employers.find_one({"_id": user_id})
                    if user:
                        user["type"] = "employer"
                except:
                    pass
                    
        if user is None:
            raise Exception("User not found")
        
        return user
        
    except JWTError:
        raise Exception("Invalid token")
    except Exception as e:
        raise Exception(f"Authentication failed: {str(e)}")

async def validate_token(token: str):
    """
    Validate a token and return the user data
    This is similar to get_current_user but accepts a token string directly
    without using the Depends mechanism
    
    Args:
        token: JWT token string
        
    Returns:
        User data dictionary if valid, None otherwise
    """
    try:
        # Decode JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "")
        user_type: str = payload.get("user_type", "")
        
        if user_id is None:
            return None
        
        # Get user from database
        db = get_database()
        user = None
        
        # Check if this is an employer token
        if user_type == "employer":
            # For employer tokens, look in the employers collection
            user = await db.employers.find_one({"_id": user_id})
            if not user:
                # Try with ObjectId conversion if string ID lookup fails
                try:
                    user = await db.employers.find_one({"_id": ObjectId(user_id)})
                except:
                    pass
            
            # Add employer type if found
            if user:
                user["user_type"] = "employer"
                user["type"] = "employer"  # Keep for backward compatibility
        else:
            # Default to looking in the users collection
            user = await db.users.find_one({"_id": user_id})
            if not user:
                # Try employers collection as fallback
                try:
                    user = await db.employers.find_one({"_id": user_id})
                    if user:
                        user["user_type"] = "employer"
                        user["type"] = "employer"  # Keep for backward compatibility
                except:
                    pass
        
        return user
    except JWTError:
        return None 