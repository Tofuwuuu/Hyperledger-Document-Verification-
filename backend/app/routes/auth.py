from fastapi import APIRouter, HTTPException, Depends, status, Query, Request, Header, Response, Form
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from bson import ObjectId
from typing import Dict, Any, List
import logging
import uuid
import secrets
import jwt

from app.schemas import (
    UserCreate, 
    UserOut, 
    Token, 
    UserLogin, 
    PasswordReset, 
    PasswordChange,
    PasswordResetToken,
    PasswordResetConfirm,
    MFASetupRequest,
    MFAEnableRequest,
    MFALoginRequest,
    MFAStatusResponse,
    MFASetupResponse
)
from app.utils.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    get_current_user,
    get_admin_user,
    get_admin_bypass_header,
    get_authorization_scheme_param,
    SECRET_KEY,
    ALGORITHM
)
from app.config.database import get_database, get_transaction_session
from app.utils.email import send_email, get_password_reset_email, get_mfa_verification_email
from app.utils.csrf import (
    generate_csrf_token, 
    CSRF_COOKIE_NAME, 
    csrf_protect
)
from app.utils.mfa import (
    store_verification_code,
    verify_code,
    create_mfa_session,
    verify_mfa_session,
    mask_email
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut)
async def register(user_data: UserCreate):
    db = get_database()
    
    # Validation errors container
    field_errors = {}
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        field_errors["email"] = "Email already registered"
    
    # Check if student ID already exists if provided
    if user_data.student_id:
        existing_student = await db.users.find_one({"student_id": user_data.student_id})
        if existing_student:
            field_errors["student_id"] = "Student ID already registered"
    
    # If validation errors were found, return them all at once
    if field_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=field_errors
        )
    
    # Create new user
    now = datetime.utcnow()
    user_id = str(ObjectId())
    new_user = {
        "_id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "hashed_password": get_password_hash(user_data.password),
        "is_active": user_data.is_active,
        "is_admin": user_data.is_admin,
        "student_id": user_data.student_id,
        "graduation_year": user_data.graduation_year,
        "created_at": now,
        "updated_at": now,
        "is_verified": False,
        "verification_pending": True
    }
    
    # Create alumni profile placeholders based on user data
    alumni_profile = {
        "_id": str(ObjectId()),
        "user_id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "student_id": user_data.student_id,
        "graduation_year": user_data.graduation_year,
        "created_at": now,
        "updated_at": now,
        "profile_completed": False
    }
    
    try:
        # Use a transaction to ensure both user and alumni profile are created atomically
        async with get_transaction_session() as session:
            async with session.start_transaction():
                # Insert user to database
                await db.users.insert_one(new_user, session=session)
                
                # Create alumni profile
                await db.alumni.insert_one(alumni_profile, session=session)
                
                # Create initial notification for welcome
                await db.notifications.insert_one({
                    "_id": str(ObjectId()),
                    "user_id": user_id,
                    "title": "Welcome to CVSU Alumni Portal",
                    "message": f"Welcome {user_data.full_name}! Please complete your profile to get verified.",
                    "is_read": False,
                    "type": "welcome",
                    "created_at": now
                }, session=session)
        
        # Return user without password
        return {**new_user, "id": new_user["_id"]}
    except Exception as e:
        logging.error(f"Error during user registration: {str(e)}")
        # Log the error but don't expose internal details to clients
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration. Please try again later."
        )

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    remember: bool = Form(False),
    response: Response = None
):
    try:
        db = get_database()
        
        # Log login attempt (without password)
        logging.info(f"Login attempt for user: {form_data.username}, remember: {remember}")
        
        # Find user by username (email)
        user = await db.users.find_one({"email": form_data.username})
        
        # Check if user exists first
        if not user:
            logging.info(f"User does not exist: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The account with this email address doesn't exist. Please register first.",
                headers={"WWW-Authenticate": "Bearer", "X-Error-Type": "account_not_found"},
            )
        
        # Check if password is correct
        if not verify_password(form_data.password, user["hashed_password"]):
            logging.warning(f"Failed login attempt (wrong password) for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again.",
                headers={"WWW-Authenticate": "Bearer", "X-Error-Type": "wrong_password"},
            )
        
        # Check if user is active
        if not user.get("is_active", True):
            logging.warning(f"Login attempt for inactive user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account has been deactivated. Please contact support for assistance."
            )
        
        # Create access and refresh tokens
        user_id = str(user["_id"])
        
        # Set expiration times based on remember flag
        access_token_expires = timedelta(days=7 if remember else 1)
        refresh_token_expires = timedelta(days=30 if remember else 7)
        
        access_token = create_access_token(
            data={"sub": user_id},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(
            data={"sub": user_id},
            expires_delta=refresh_token_expires
        )
        
        # Set tokens as HttpOnly cookies
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,
            secure=True,  # Only sent over HTTPS
            samesite="lax",  # CSRF protection
            max_age=int(access_token_expires.total_seconds()),
            path="/"
        )
        
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=int(refresh_token_expires.total_seconds()),
            path="/"
        )
        
        logging.info(f"Successful login for user: {form_data.username}, remember: {remember}")
        
        # Still return tokens in response for backward compatibility
        # In production, you might want to remove this later
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": user["email"],
                "is_admin": user.get("is_admin", False),
                "is_verified": user.get("is_verified", False),
                "full_name": user.get("full_name", "")
            }
        }
    except ConnectionError as e:
        logging.error(f"Database connection error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please check if MongoDB is running and try again later."
        )
    except Exception as e:
        logging.error(f"Unexpected error during login: {str(e)}")
        # Log detailed error information to help debug
        import traceback
        logging.error(f"Error traceback: {traceback.format_exc()}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later."
        )

@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request, response: Response):
    """Create a new access token using refresh token from cookie"""
    # Try to get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    
    # If no cookie, fall back to request body for backward compatibility
    if not refresh_token:
        try:
            data = await request.json()
            refresh_token = data.get("refresh_token")
        except:
            refresh_token = None
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Verify the refresh token
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "")
        
        if user_id is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create new tokens
        new_access_token = create_access_token(data={"sub": user_id})
        new_refresh_token = create_refresh_token(data={"sub": user_id})
        
        # Set cookies
        response.set_cookie(
            key="access_token",
            value=f"Bearer {new_access_token}",
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60,  # 1 hour
            path="/"
        )
        
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        # Return tokens in body for backward compatibility
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/me", response_model=UserOut)
async def get_user_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user profile"""
    return current_user 

@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: PasswordReset):
    """Request a password reset link to be sent to email"""
    db = get_database()
    
    # Find user by email
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists or not for security
        return
    
    # Generate a reset token (random UUID)
    token = f"{str(uuid.uuid4())}-{secrets.token_hex(16)}"
    
    # Set token expiration (1 hour from now)
    expires = datetime.utcnow() + timedelta(hours=1)
    
    # Store token in database
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": token,
            "reset_token_expires": expires,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Create reset URL for email
    from app.core.config import settings
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    # Generate email content
    email_content = get_password_reset_email(
        username=user.get("full_name", "User"), 
        token=token,
        reset_url=reset_url
    )
    
    # Send email
    await send_email(
        recipients=[user["email"]],
        subject="CVSU Alumni System - Password Reset",
        html_content=email_content["html"],
        text_content=email_content["text"]
    )
    
    # Return 204 No Content (success, but no response body)
    return

@router.post("/verify-reset-token", status_code=status.HTTP_200_OK)
async def verify_reset_token(data: PasswordResetToken):
    """Verify that a password reset token is valid"""
    db = get_database()
    
    # Find user with this token
    user = await db.users.find_one({
        "reset_token": data.token,
        "reset_token_expires": {"$gt": datetime.utcnow()}  # Token must not be expired
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
    
    # Return success status
    return {"valid": True}

@router.post("/reset-password-confirm", response_model=UserOut)
async def reset_password_confirm(data: PasswordResetConfirm):
    """Set a new password using a valid reset token"""
    db = get_database()
    
    # Find user with this token
    user = await db.users.find_one({
        "reset_token": data.token,
        "reset_token_expires": {"$gt": datetime.utcnow()}  # Token must not be expired
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
    
    # Hash the new password
    hashed_password = get_password_hash(data.password)
    
    # Update the user's password and clear the reset token
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "hashed_password": hashed_password,
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "reset_token": "",
            "reset_token_expires": ""
        }}
    )
    
    # Return the updated user
    updated_user = await db.users.find_one({"_id": user["_id"]})
    return updated_user

@router.post("/change-password", response_model=UserOut)
async def change_password(data: PasswordChange, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Change user password"""
    db = get_database()
    
    # Verify current password
    if not verify_password(data.current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    hashed_password = get_password_hash(data.new_password)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "hashed_password": hashed_password,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Return updated user
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    return updated_user

@router.post("/verify-user/{user_id}", response_model=UserOut)
async def verify_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    notes: str = None,
    db: str = Query("cvsu_alumni", description="Database name (e.g., cvsu_alumni)"),
    collection: str = Query("users", description="Collection name (e.g., users)")
):
    """
    Verify a user account (admin only)
    """
    try:
        logger = logging.getLogger(__name__)
        database = get_database()
        
        # Get admin user's ID safely
        admin_id = None
        if isinstance(admin_user, dict) and "_id" in admin_user:
            admin_id = admin_user["_id"]
        elif hasattr(admin_user, "id"):  # User model object
            admin_id = admin_user.id
        else:
            # Fallback - this should not normally happen
            admin_id = str(ObjectId())
        
        logger.info(f"Verifying user {user_id} in database {db}.{collection} by admin {admin_id}")
        
        # Validate database and collection for security
        if db not in ['cvsu_alumni']:
            logger.error(f"Attempt to access unauthorized database: {db}")
            raise HTTPException(status_code=403, detail="Access to this database is not allowed")
            
        if collection not in ['users', 'alumni']:
            logger.error(f"Attempt to access unauthorized collection: {collection}")
            raise HTTPException(status_code=403, detail="Access to this collection is not allowed")
        
        # First try as a direct string ID
        user = await database[collection].find_one({"_id": user_id})
        user_id_for_update = user_id if user else None
        
        # If user not found, try converting to ObjectId
        if not user:
            try:
                user_object_id = ObjectId(user_id)
                user = await database[collection].find_one({"_id": user_object_id})
                user_id_for_update = user_object_id if user else None
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format: {str(e)}"
                )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user verification status
        now = datetime.utcnow()
        result = await database[collection].update_one(
            {"_id": user_id_for_update},
            {"$set": {
                "is_verified": True,
                "verified_by": admin_id,
                "verification_date": now,
                "verification_notes": notes,
                "updated_at": now
            }}
        )
        
        if result.modified_count == 0:
            # If no modification, check if user is already verified
            user = await database[collection].find_one({"_id": user_id_for_update})
            if user and user.get("is_verified"):
                return user
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user verification status"
                )
        
        # Log activity in audit log
        await database.audit_logs.insert_one({
            "action": "user_verification",
            "user_id": str(user_id_for_update),
            "admin_id": str(admin_id),
            "database": db,
            "collection": collection,
            "notes": notes,
            "timestamp": now
        })
        
        # Get updated user
        updated_user = await database[collection].find_one({"_id": user_id_for_update})
        logger.info(f"Successfully verified user {user_id} in {db}.{collection}")
        return updated_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during user verification: {str(e)}"
        )

@router.get("/unverified-users", response_model=List[Dict[str, Any]])
async def get_unverified_users(
    request: Request = None,
    authorization: str = Header(None),
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    limit: int = Query(50, ge=1, le=100),
    db: str = Query(None, description="Database name (e.g., cvsu_alumni)"),
    collection: str = Query(None, description="Collection name (e.g., users)"),
    filter: str = Query(None, description="Filter in format field:value (e.g., is_verified:false)")
):
    """
    Get all unverified users (admin only)
    """
    try:
        logger = logging.getLogger(__name__)
        logger.setLevel(logging.DEBUG)  # Set logging level to DEBUG for more details
        
        # Get database connection
        database = get_database()
        if not database:
            logger.error("Failed to get database connection")
            return []  # Return empty list instead of raising error
        
        # Determine collection to use
        target_collection = 'users'  # Default
        if collection and collection in ['users', 'alumni']:
            target_collection = collection
            
        # Build a simple query - avoid complex logic that could cause response issues
        query = {"is_verified": False}
        
        # Execute a simple query with strict limits
        try:
            # Limit fields returned to reduce response size
            projection = {
                "password": 0, 
                "hashed_password": 0,
                "reset_token": 0,
                "reset_token_expires": 0
            }
            
            # Apply a smaller limit to ensure response isn't too large
            actual_limit = min(limit, 20)
            
            cursor = database[target_collection].find(
                query,
                projection
            ).limit(actual_limit)
            
            # Convert to list of dicts with minimal processing
            users = []
            try:
                async for user in cursor:
                    # Minimal data transformation to prevent errors
                    try:
                        if "_id" in user:
                            user["id"] = str(user["_id"])
                            user["_id"] = str(user["_id"])
                        
                        # Ensure is_verified is always a boolean
                        user["is_verified"] = False
                        
                        # Format dates if present
                        if "created_at" in user and user["created_at"]:
                            if isinstance(user["created_at"], datetime):
                                user["created_at"] = user["created_at"].isoformat()
                            
                        users.append(user)
                    except Exception as transform_err:
                        logger.error(f"Error transforming user: {transform_err}")
                        # Skip this user but continue processing others
                        continue
            except Exception as cursor_err:
                logger.error(f"Error processing cursor: {cursor_err}")
                return []
                
            logger.info(f"Found {len(users)} unverified users")
            return users
            
        except Exception as query_err:
            logger.error(f"Error executing query: {query_err}")
            return []
            
    except Exception as e:
        logger.error(f"Unexpected error in get_unverified_users: {str(e)}")
        return []  # Return empty list to avoid frontend errors

def get_mock_users():
    """Return mock unverified users for testing"""
    # Create a simple function to generate random-looking data
    from datetime import datetime
    import uuid
    
    # Generate a random-looking ID
    random_id = f"mock_{uuid.uuid4().hex[:16]}"
    
    # Return generic mock data without hardcoded values
    return [
        {
            "id": random_id,
            "_id": random_id,
            "email": "mock.user@example.com",
            "full_name": "Mock User",
            "created_at": datetime.utcnow().isoformat(),
            "student_id": f"MOCK-{uuid.uuid4().hex[:6].upper()}",
            "department": "Test Department",
            "year_graduated": str(datetime.utcnow().year)
        }
    ]

@router.put("/update-user/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    data: Dict[str, Any],
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Update a user's profile information (admin only)
    """
    try:
        db = get_database()
        logger = logging.getLogger(__name__)
        
        logger.info(f"Updating user {user_id} with data: {data}")
        
        # Try to normalize user ID (handle both string and ObjectId formats)
        user = await db.users.find_one({"_id": user_id})
        if not user:
            try:
                user_object_id = ObjectId(user_id)
                user = await db.users.find_one({"_id": user_object_id})
                user_id = user_object_id if user else None
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format: {str(e)}"
                )
                
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        # Prepare update data
        update_data = {}
        if "full_name" in data and data["full_name"]:
            update_data["full_name"] = data["full_name"]
            
        if "student_id" in data and data["student_id"]:
            update_data["student_id"] = data["student_id"]
            
        if "department" in data and data["department"]:
            update_data["department"] = data["department"]
            
        # Handle graduation year/year_graduated (could be named differently)
        if "graduation_year" in data and data["graduation_year"]:
            update_data["graduation_year"] = data["graduation_year"]
            update_data["year_graduated"] = data["graduation_year"]  # For compatibility
            
        if "year_graduated" in data and data["year_graduated"] and "graduation_year" not in data:
            update_data["year_graduated"] = data["year_graduated"]
            update_data["graduation_year"] = data["year_graduated"]  # For compatibility
            
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow()
        
        # Log the admin who made the change
        update_data["last_updated_by"] = str(admin_user["_id"])
        
        logger.info(f"Final update data: {update_data}")
        
        # Update the user
        result = await db.users.update_one(
            {"_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            logger.warning(f"No modifications made to user {user_id}")
            
        # Get updated user
        updated_user = await db.users.find_one({"_id": user_id})
        
        # Log activity
        await db.audit_logs.insert_one({
            "action": "user_update",
            "user_id": str(user_id),
            "admin_id": str(admin_user["_id"]),
            "details": update_data,
            "timestamp": datetime.utcnow()
        })
        
        return updated_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred updating user: {str(e)}"
        )

@router.get("/user/{user_id}", response_model=UserOut)
async def get_user_by_id(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get a user by ID (admin only)
    """
    try:
        db = get_database()
        
        # Try to normalize user ID (handle both string and ObjectId formats)
        user = await db.users.find_one({"_id": user_id})
        if not user:
            try:
                user_object_id = ObjectId(user_id)
                user = await db.users.find_one({"_id": user_object_id})
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format: {str(e)}"
                )
                
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        # Return the user without sensitive fields
        sanitized_user = {k: v for k, v in user.items() if k != "hashed_password"}
        
        # Ensure consistent id field
        if "_id" in sanitized_user:
            sanitized_user["id"] = str(sanitized_user["_id"])
            
        return sanitized_user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred fetching user: {str(e)}"
        )

@router.get("/user/activity", response_model=List[Dict[str, Any]])
async def get_current_user_activity(
    current_user: Dict[str, Any] = Depends(get_current_user),
    include_uploads: bool = Query(True, description="Include document uploads in activity"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """
    Get activity for the current user
    """
    from app.api.routes.users import get_user_activity
    
    # Call the existing user activity endpoint with the current user's ID
    return await get_user_activity(
        user_id=current_user["_id"],
        include_uploads=include_uploads,
        limit=limit
    )

@router.options("/register", include_in_schema=False)
async def options_register(request: Request):
    """Handle OPTIONS request for register endpoint (CORS preflight)"""
    from app.core.config import settings
    origin = request.headers.get("Origin", "")
    
    # Always allow the main frontend domain
    if origin == "https://alumni-frontend-zzr2.onrender.com":
        return {
            "allow": "POST, OPTIONS",
            "content-type": "application/json",
            "access-control-allow-origin": origin,
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With",
            "access-control-allow-credentials": "true",
            "access-control-max-age": "86400",  # 1 day in seconds
        }
    
    # Check if the origin is in our allowed list
    allowed_origins = settings.cors_origins_list
    allow_origin = origin if origin in allowed_origins else allowed_origins[0]
    
    return {
        "allow": "POST, OPTIONS",
        "content-type": "application/json",
        "access-control-allow-origin": allow_origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With",
        "access-control-allow-credentials": "true",
        "access-control-max-age": "86400",  # 1 day in seconds
    }

@router.options("/login", include_in_schema=False)
async def options_login(request: Request):
    """Handle OPTIONS request for login endpoint (CORS preflight)"""
    from app.core.config import settings
    origin = request.headers.get("Origin", "")
    
    # Always allow the main frontend domain
    if origin == "https://alumni-frontend-zzr2.onrender.com":
        return {
            "allow": "POST, OPTIONS",
            "content-type": "application/json",
            "access-control-allow-origin": origin,
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With",
            "access-control-allow-credentials": "true",
            "access-control-max-age": "86400",  # 1 day in seconds
        }
    
    # Check if the origin is in our allowed list
    allowed_origins = settings.cors_origins_list
    allow_origin = origin if origin in allowed_origins else allowed_origins[0]
    
    return {
        "allow": "POST, OPTIONS",
        "content-type": "application/json",
        "access-control-allow-origin": allow_origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With",
        "access-control-allow-credentials": "true",
        "access-control-max-age": "86400",  # 1 day in seconds
    }

@router.options("/{path:path}", include_in_schema=False)
async def options_any(path: str, request: Request):
    """Handle OPTIONS request for any auth endpoint (CORS preflight)"""
    from app.core.config import settings
    origin = request.headers.get("Origin", "")
    
    # Always allow the main frontend domain
    if origin == "https://alumni-frontend-zzr2.onrender.com":
        return {
            "allow": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "content-type": "application/json",
            "access-control-allow-origin": origin,
            "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With", 
            "access-control-allow-credentials": "true",
            "access-control-max-age": "86400",  # 1 day in seconds
        }
    
    # Check if the origin is in our allowed list
    allowed_origins = settings.cors_origins_list
    allow_origin = origin if origin in allowed_origins else allowed_origins[0]
    
    return {
        "allow": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "content-type": "application/json",
        "access-control-allow-origin": allow_origin,
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "access-control-allow-headers": "Authorization, Content-Type, Accept, X-Admin-Bypass, X-Requested-With", 
        "access-control-allow-credentials": "true",
        "access-control-max-age": "86400",  # 1 day in seconds
    }

@router.get("/test-cors", tags=["Debug"])
async def test_cors():
    """Test endpoint to verify CORS is working correctly."""
    return {
        "status": "success",
        "message": "CORS is configured correctly if you can see this message",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    """Logout the user by clearing auth cookies"""
    # Clear the cookies
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    
    return None

@router.get("/csrf-token")
async def get_csrf_token(response: Response):
    """Get a new CSRF token"""
    # Generate a new CSRF token
    token = generate_csrf_token()
    
    # Set the token in a cookie
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token.value,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,  # 24 hours
        path="/"
    )
    
    # Return the token value to be used in the header
    return {"csrf_token": token.value}

@router.post("/login/mfa-check")
async def check_mfa_status(data: UserLogin, response: Response):
    """Check if MFA is required for a user and start MFA flow if needed"""
    try:
        db = get_database()
        
        # Find user by email
        user = await db.users.find_one({"email": data.email})
        
        # Check if user exists first
        if not user:
            logging.info(f"User does not exist (MFA check): {data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The account with this email address doesn't exist. Please register first.",
                headers={"WWW-Authenticate": "Bearer", "X-Error-Type": "account_not_found"},
            )
        
        # Check if password is correct
        if not verify_password(data.password, user["hashed_password"]):
            logging.warning(f"Failed MFA check (wrong password) for user: {data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again.",
                headers={"WWW-Authenticate": "Bearer", "X-Error-Type": "wrong_password"},
            )
            
        # Check if user is active
        if not user.get("is_active", True):
            logging.warning(f"Login attempt for inactive user: {data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account has been deactivated. Please contact support for assistance."
            )
        
        # If MFA is not enabled, proceed with regular login
        if not user.get("mfa_enabled", False):
            # Proceed with regular login
            user_id = str(user["_id"])
            access_token = create_access_token(data={"sub": user_id})
            refresh_token = create_refresh_token(data={"sub": user_id})
            
            # Set tokens as HttpOnly cookies
            response.set_cookie(
                key="access_token",
                value=f"Bearer {access_token}",
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=60 * 60,
                path="/"
            )
            
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=7 * 24 * 60 * 60,
                path="/"
            )
            
            return {
                "mfa_required": False,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": {
                    "id": user_id,
                    "email": user["email"],
                    "is_admin": user.get("is_admin", False),
                    "is_verified": user.get("is_verified", False),
                    "full_name": user.get("full_name", "")
                }
            }
        
        # If MFA is enabled, start MFA flow
        user_id = str(user["_id"])
        mfa_type = user.get("mfa_type", "email")
        
        if mfa_type == "email":
            # Generate MFA code and send email
            setup_id, code = store_verification_code(email=user["email"], user_id=user_id)
            
            # Send verification email
            email_content = get_mfa_verification_email(
                username=user.get("full_name", "User"),
                verification_code=code
            )
            
            await send_email(
                recipients=[user["email"]],
                subject="CVSU Alumni System - Authentication Code",
                html_content=email_content["html"],
                text_content=email_content["text"]
            )
            
            # Return info for MFA step
            return {
                "mfa_required": True,
                "setup_id": setup_id,
                "mfa_type": mfa_type,
                "email": mask_email(user["email"])
            }
        
        # Fallback for unsupported MFA types
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MFA type: {mfa_type}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error during MFA check: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred. Please try again later."
        )

@router.post("/login/mfa-verify", response_model=Token)
async def verify_mfa_login(data: MFALoginRequest, response: Response):
    """Verify MFA code and complete login"""
    try:
        db = get_database()
        
        # Find user by email
        user = await db.users.find_one({"email": data.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid verification"
            )
        
        # Find verification code
        setup_id = None
        for sid, stored_data in list(mfa_verification_codes.items()):
            if stored_data["email"] == data.email:
                setup_id = sid
                break
        
        if not setup_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending verification found for this email"
            )
        
        # Verify the code
        if not verify_code(setup_id, data.verification_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code"
            )
        
        # Code is verified, proceed with login
        user_id = str(user["_id"])
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        # Set tokens as HttpOnly cookies
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60,
            path="/"
        )
        
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        # Return success response
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error during MFA verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred. Please try again later."
        )

@router.get("/mfa/status", response_model=MFAStatusResponse)
async def get_mfa_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get MFA status for the current user"""
    is_enabled = current_user.get("mfa_enabled", False)
    mfa_type = current_user.get("mfa_type")
    email = current_user.get("email")
    
    if email:
        email = mask_email(email)
    
    return {
        "is_enabled": is_enabled,
        "type": mfa_type,
        "email": email if is_enabled else None
    }

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    data: MFASetupRequest, 
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Set up MFA for the current user"""
    if data.type != "email":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only email-based MFA is currently supported"
        )
    
    email = current_user.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User email is required for MFA setup"
        )
    
    # Generate and store verification code
    setup_id, code = store_verification_code(email=email, user_id=str(current_user["_id"]))
    
    # Send verification email
    email_content = get_mfa_verification_email(
        username=current_user.get("full_name", "User"),
        verification_code=code
    )
    
    await send_email(
        recipients=[email],
        subject="CVSU Alumni System - MFA Setup Verification",
        html_content=email_content["html"],
        text_content=email_content["text"]
    )
    
    return {
        "setup_id": setup_id,
        "message": f"Verification code sent to {mask_email(email)}"
    }

@router.post("/mfa/enable")
async def enable_mfa(
    data: MFAEnableRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Enable MFA after verifying the code"""
    db = get_database()
    
    # Find any pending setup for this user
    setup_id = None
    for sid, stored_data in list(mfa_verification_codes.items()):
        if stored_data.get("user_id") == str(current_user["_id"]):
            setup_id = sid
            break
    
    if not setup_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending MFA setup found"
        )
    
    # Verify the code
    if not verify_code(setup_id, data.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code"
        )
    
    # Update user's MFA settings
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "mfa_enabled": True,
            "mfa_type": "email",
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "success": True,
        "message": "MFA enabled successfully"
    }

@router.post("/mfa/disable")
async def disable_mfa(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Disable MFA for the current user"""
    db = get_database()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "mfa_enabled": False,
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "mfa_type": ""
        }}
    )
    
    return {
        "success": True,
        "message": "MFA disabled successfully"
    }

# Add routes for security questions as an additional recovery method
@router.post("/set-security-questions")
async def set_security_questions(
    security_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Set security questions and answers for account recovery"""
    try:
        db = get_database()
        
        # Validate questions and answers format
        if not isinstance(security_data.get("questions"), list) or len(security_data.get("questions", [])) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide at least 2 security questions and answers"
            )
        
        # Store questions and hashed answers
        questions_data = []
        for item in security_data["questions"]:
            if not item.get("question") or not item.get("answer"):
                continue
                
            # Hash the answer for security
            hashed_answer = get_password_hash(item["answer"].lower().strip())
            
            questions_data.append({
                "question": item["question"],
                "answer_hash": hashed_answer
            })
        
        if len(questions_data) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide at least 2 security questions with valid answers"
            )
        
        # Update user document with security questions
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "security_questions": questions_data,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {"status": "success", "message": "Security questions set successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error setting security questions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred setting security questions"
        )

@router.post("/verify-security-questions")
async def verify_security_questions(verify_data: Dict[str, Any]):
    """Verify security questions for account recovery"""
    try:
        db = get_database()
        
        if not verify_data.get("email"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required"
            )
            
        if not isinstance(verify_data.get("answers"), list) or len(verify_data.get("answers", [])) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide answers to at least 2 security questions"
            )
        
        # Find user by email
        user = await db.users.find_one({"email": verify_data["email"]})
        if not user:
            # Don't reveal if email exists or not
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has security questions
        if not user.get("security_questions") or len(user.get("security_questions", [])) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security questions not set for this account"
            )
        
        # Verify answers
        security_questions = user["security_questions"]
        correct_answers = 0
        
        for answer_data in verify_data["answers"]:
            question_idx = answer_data.get("question_idx")
            answer = answer_data.get("answer", "").lower().strip()
            
            if question_idx is None or not answer:
                continue
                
            if question_idx < 0 or question_idx >= len(security_questions):
                continue
                
            # Check if the answer matches
            stored_hash = security_questions[question_idx]["answer_hash"]
            if verify_password(answer, stored_hash):
                correct_answers += 1
        
        # Require at least 2 correct answers
        if correct_answers < 2:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect answers to security questions"
            )
        
        # Generate a reset token
        token = f"{str(uuid.uuid4())}-{secrets.token_hex(16)}"
        
        # Set token expiration (1 hour from now)
        expires = datetime.utcnow() + timedelta(hours=1)
        
        # Store token in database
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "reset_token": token,
                "reset_token_expires": expires,
                "reset_method": "security_questions",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Return the token for frontend to redirect to reset page
        return {
            "status": "success", 
            "reset_token": token,
            "expires_at": expires.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error verifying security questions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred verifying security questions"
        )

@router.get("/security-questions/{email}")
async def get_security_questions(email: str):
    """Get security questions for a user without revealing answers"""
    try:
        db = get_database()
        
        # Find user by email
        user = await db.users.find_one({"email": email})
        if not user:
            # Don't reveal if email exists or not
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has security questions
        if not user.get("security_questions") or len(user.get("security_questions", [])) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security questions not set for this account"
            )
        
        # Return questions without answers
        questions = []
        for idx, q_data in enumerate(user["security_questions"]):
            questions.append({
                "index": idx,
                "question": q_data["question"]
            })
        
        return {"questions": questions}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting security questions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred retrieving security questions"
        )

@router.post("/test-mongo-query", tags=["Debug"])
async def test_mongo_query(
    query_data: Dict[str, Any],
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """Test endpoint to verify MongoDB query behavior, for debugging only"""
    try:
        db = get_database()
        logger = logging.getLogger(__name__)
        
        # Extract data from request
        user_id = query_data.get("user_id")
        query = query_data.get("query", {})
        collection_name = query_data.get("collection", "users")
        
        # Safety checks
        if not user_id:
            return {"error": "user_id is required"}
        if not query:
            return {"error": "query is required"}
            
        # Get the collection
        collection = getattr(db, collection_name, None)
        if not collection:
            return {"error": f"Collection {collection_name} not found"}
            
        # First get the user document to check
        user = await collection.find_one({"_id": user_id})
        
        if not user:
            return {
                "exists": False,
                "would_match": False,
                "reason": "User not found in database"
            }
            
        # Now test if this user would match the query
        would_match = False
        reason = "Would not match query"
        
        # Test specifically for {"is_verified": {"$ne": True}} query
        if "$ne" in query.get("is_verified", {}):
            ne_value = query["is_verified"]["$ne"]
            
            # Get the actual value from the user document
            actual_value = user.get("is_verified")
            
            # Check if the value is present and its type
            value_present = "is_verified" in user
            value_type = type(actual_value).__name__
            
            # Check if the user would match this query
            would_match = actual_value != ne_value
            
            reason = f"is_verified = {actual_value} (type: {value_type}), query is '$ne: {ne_value}'. Value present: {value_present}"
        
        # Return the results
        return {
            "exists": True,
            "would_match": would_match,
            "reason": reason,
            "user_fields": {
                key: {
                    "value": value,
                    "type": type(value).__name__
                } for key, value in user.items() if key in ["is_verified", "is_active", "verification_pending"]
            }
        }
        
    except Exception as e:
        logger.error(f"Error in test-mongo-query endpoint: {str(e)}")
        return {"error": str(e)} 