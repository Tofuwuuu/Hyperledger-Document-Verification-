from fastapi import APIRouter, HTTPException, Depends, status, Query, Request, Header
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from bson import ObjectId
from typing import Dict, Any, List
import logging

from app.schemas import (
    UserCreate, 
    UserOut, 
    Token, 
    UserLogin, 
    PasswordReset, 
    PasswordChange
)
from app.utils.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    get_current_user,
    get_admin_user,
    get_admin_bypass_header,
    get_authorization_scheme_param
)
from app.config.database import get_database

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
    new_user = {
        "_id": str(ObjectId()),
        "email": user_data.email,
        "full_name": user_data.full_name,
        "hashed_password": get_password_hash(user_data.password),
        "is_active": user_data.is_active,
        "is_admin": user_data.is_admin,
        "student_id": user_data.student_id,
        "graduation_year": user_data.graduation_year,
        "created_at": now,
        "updated_at": now
    }
    
    try:
        # Insert user to database
        await db.users.insert_one(new_user)
        
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
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        db = get_database()
        
        # Log login attempt (without password)
        logging.info(f"Login attempt for user: {form_data.username}")
        
        # Find user by username (email)
        user = await db.users.find_one({"email": form_data.username})
        
        # Check if user exists and password is correct
        if not user or not verify_password(form_data.password, user["hashed_password"]):
            logging.warning(f"Failed login attempt for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.get("is_active", True):
            logging.warning(f"Login attempt for inactive user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Create access and refresh tokens
        user_id = str(user["_id"])
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        logging.info(f"Successful login for user: {form_data.username}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
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
async def refresh_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Create a new access token using refresh token"""
    user_id = current_user["_id"]
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user_id})
    refresh_token = create_refresh_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

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
    
    # Here you would implement password reset logic
    # - Generate a reset token
    # - Store it in the database with an expiration
    # - Send an email to the user with a reset link
    
    return

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
    notes: str = None
):
    """
    Verify a user account (admin only)
    """
    try:
        db = get_database()
        
        # Get admin user's ID safely
        admin_id = None
        if isinstance(admin_user, dict) and "_id" in admin_user:
            admin_id = admin_user["_id"]
        elif hasattr(admin_user, "id"):  # User model object
            admin_id = admin_user.id
        else:
            # Fallback - this should not normally happen
            admin_id = str(ObjectId())
            
        # First try as a direct string ID
        user = await db.users.find_one({"_id": user_id})
        user_id_for_update = user_id if user else None
        
        # If user not found, try converting to ObjectId
        if not user:
            try:
                user_object_id = ObjectId(user_id)
                user = await db.users.find_one({"_id": user_object_id})
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
        result = await db.users.update_one(
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
            user = await db.users.find_one({"_id": user_id_for_update})
            if user and user.get("is_verified"):
                return user
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user verification status"
                )
        
        # Log activity in audit log
        await db.audit_logs.insert_one({
            "action": "user_verification",
            "user_id": str(user_id_for_update),
            "admin_id": str(admin_id),
            "notes": notes,
            "timestamp": now
        })
        
        # Get updated user
        updated_user = await db.users.find_one({"_id": user_id_for_update})
        return updated_user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during user verification: {str(e)}"
        )

@router.get("/unverified-users", response_model=List[Dict[str, Any]])
async def get_unverified_users(
    request: Request = None,
    authorization: str = Header(None),
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all unverified users (admin only)
    """
    try:
        print(f"Fetching unverified users for admin: {admin_user.get('email', 'Unknown admin')}")
        print(f"Admin user type: {type(admin_user)}")
        print(f"Admin user data: {admin_user}")
        
        # Check for admin bypass
        admin_bypass = False
        if request and authorization:
            admin_bypass_header = get_admin_bypass_header(request)
            scheme, param = get_authorization_scheme_param(authorization)
            
            if admin_bypass_header == "true" and scheme.lower() == "bearer" and param and param.startswith("admin_access_token_"):
                print(f"Admin bypass detected in unverified-users route")
                admin_bypass = True
        
        db = get_database()
        
        # Find unverified users
        cursor = db.users.find(
            {"is_verified": {"$ne": True}},  # Users where is_verified is not true
            sort=[("created_at", -1)],
            limit=limit
        )
        
        # Process users
        users = []
        async for user in cursor:
            print(f"Found unverified user: {user.get('email', 'Unknown email')}")
            
            # Create a sanitized user object (no password)
            sanitized_user = {
                # Keep both id and _id to maintain backward compatibility
                "id": str(user["_id"]),
                "_id": str(user["_id"]),
                "email": user["email"],
                "full_name": user.get("full_name", ""),
                "created_at": user["created_at"].isoformat() if "created_at" in user else None,
                "student_id": user.get("student_id", ""),
                "department": user.get("department", ""),
                "year_graduated": user.get("year_graduated", "")
            }
            users.append(sanitized_user)
        
        # If no users found and admin bypass is active, create some mock users
        if admin_bypass and len(users) == 0:
            print("Admin bypass active and no unverified users found, returning mock data")
            
            # Create sample unverified users for testing the UI
            mock_users = [
                {
                    "id": f"mock_user_id_1",
                    "_id": f"mock_user_id_1",
                    "email": "student1@cvsu.edu.ph",
                    "full_name": "John Smith",
                    "created_at": datetime.utcnow().isoformat(),
                    "student_id": "2023-0001",
                    "department": "Computer Science",
                    "year_graduated": "2023"
                },
                {
                    "id": f"mock_user_id_2",
                    "_id": f"mock_user_id_2",
                    "email": "student2@cvsu.edu.ph",
                    "full_name": "Jane Doe",
                    "created_at": datetime.utcnow().isoformat(),
                    "student_id": "2023-0002", 
                    "department": "Information Technology",
                    "year_graduated": "2023"
                }
            ]
            
            return mock_users
        
        print(f"Returning {len(users)} unverified users")
        return users
    
    except Exception as e:
        print(f"Error in get_unverified_users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred fetching unverified users: {str(e)}"
        )

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
async def options_register():
    """Handle OPTIONS request for register endpoint (CORS preflight)"""
    return {
        "allow": "POST, OPTIONS",
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "*",
    }

@router.options("/login", include_in_schema=False)
async def options_login():
    """Handle OPTIONS request for login endpoint (CORS preflight)"""
    return {
        "allow": "POST, OPTIONS",
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "*",
    }

@router.options("/{path:path}", include_in_schema=False)
async def options_any(path: str):
    """Handle OPTIONS request for any auth endpoint (CORS preflight)"""
    return {
        "allow": "GET, POST, PUT, DELETE, OPTIONS",
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "*",
    }

@router.get("/test-cors", tags=["Debug"])
async def test_cors():
    """Test endpoint to verify CORS is working correctly."""
    return {
        "status": "success",
        "message": "CORS is configured correctly if you can see this message",
        "timestamp": datetime.utcnow().isoformat()
    } 