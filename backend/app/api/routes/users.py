from fastapi import APIRouter, Depends, HTTPException, status, Path, Query, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
import os
import shutil
from uuid import uuid4

from app.utils.auth import get_admin_user, get_password_hash
from app.config.database import get_database
from app.schemas import UserCreate, UserUpdate, UserOut, RoleOut, UserPaginatedResponse

router = APIRouter()

# Helper function to convert ObjectId to string
def serialize_id(item):
    if "_id" in item:
        item["id"] = str(item["_id"])
        del item["_id"]
    return item

@router.get("/users", response_model=UserPaginatedResponse)
async def get_all_admin_users(
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page")
):
    """
    Get a paginated list of all admin users
    """
    db = get_database()
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    # Get total count of admin users
    total = await db.users.count_documents({"is_admin": True})
    
    # Get admin users with pagination
    cursor = db.users.find({"is_admin": True}).sort("full_name", 1).skip(skip).limit(limit)
    
    users = []
    async for user in cursor:
        # Serialize the user (remove password hash for security)
        user = serialize_id(user)
        if "hashed_password" in user:
            del user["hashed_password"]
        
        # Get role information if role_id exists
        if "role_id" in user and user["role_id"]:
            try:
                role = await db.roles.find_one({"_id": ObjectId(user["role_id"])})
                if role:
                    role = serialize_id(role)
                    user["role"] = role["name"]
            except:
                user["role"] = "Unknown"
        else:
            user["role"] = "No Role"
        
        users.append(user)
    
    # Calculate total pages
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": users,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": total_pages
        }
    }

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    user_data: UserCreate,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Create a new admin user
    """
    db = get_database()
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{user_data.email}' already exists"
        )
    
    # Check if role exists if role_id is provided
    if user_data.role_id:
        try:
            role = await db.roles.find_one({"_id": ObjectId(user_data.role_id)})
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Role with ID {user_data.role_id} not found"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role ID format: {str(e)}"
            )
    
    # Prepare user data
    now = datetime.utcnow()
    user_dict = user_data.dict(exclude={"password"})
    user_dict["hashed_password"] = get_password_hash(user_data.password)
    user_dict["is_admin"] = True  # Ensure user is admin
    user_dict["created_at"] = now
    user_dict["updated_at"] = now
    
    try:
        # Insert user
        result = await db.users.insert_one(user_dict)
        
        # Get created user
        created_user = await db.users.find_one({"_id": result.inserted_id})
        created_user = serialize_id(created_user)
        
        # Remove sensitive information
        if "hashed_password" in created_user:
            del created_user["hashed_password"]
        
        return created_user
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{user_data.email}' already exists"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create admin user: {str(e)}"
        )

@router.get("/users/{user_id}", response_model=UserOut)
async def get_admin_user_by_id(
    user_id: str = Path(..., description="The ID of the user to get"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get an admin user by ID
    """
    db = get_database()
    
    try:
        # Get the user
        user = await db.users.find_one({"_id": user_id, "is_admin": True})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Admin user with ID {user_id} not found"
            )
        
        user_dict = serialize_id(user)
        
        # For admin bypass users, ensure _id is present for schema validation
        if not "_id" in user_dict and "id" in user_dict:
            user_dict["_id"] = user_dict["id"]
        
        # Remove sensitive information
        if "hashed_password" in user_dict:
            del user_dict["hashed_password"]
        
        # Get role information if role_id exists
        if "role_id" in user_dict and user_dict["role_id"]:
            try:
                role = await db.roles.find_one({"_id": ObjectId(user_dict["role_id"])})
                if role:
                    role = serialize_id(role)
                    user_dict["role"] = role["name"]
            except:
                user_dict["role"] = "Unknown"
        else:
            user_dict["role"] = "No Role"
        
        return user_dict
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format or database error: {str(e)}"
        )

@router.put("/users/{user_id}", response_model=UserOut)
async def update_admin_user(
    user_data: UserUpdate,
    user_id: str = Path(..., description="The ID of the user to update"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Update an existing admin user
    """
    db = get_database()
    
    # Check if user exists
    user = await db.users.find_one({"_id": user_id, "is_admin": True})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found"
        )
    
    # Prepare update data
    update_data = user_data.dict(exclude_unset=True)
    
    # Handle password update
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]
    
    # Check if role exists if role_id is updated
    if "role_id" in update_data and update_data["role_id"]:
        try:
            role = await db.roles.find_one({"_id": ObjectId(update_data["role_id"])})
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Role with ID {update_data['role_id']} not found"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role ID format: {str(e)}"
            )
    
    # Update the user
    update_data["updated_at"] = datetime.utcnow()
    try:
        await db.users.update_one(
            {"_id": user_id},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await db.users.find_one({"_id": user_id})
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found after update"
            )
            
        # Properly handle the _id field for admin bypass users with string IDs
        user_dict = serialize_id(updated_user)
        
        # For admin bypass users, ensure _id is present for schema validation
        if not "_id" in user_dict and "id" in user_dict:
            user_dict["_id"] = user_dict["id"]
        
        # Remove sensitive information
        if "hashed_password" in user_dict:
            del user_dict["hashed_password"]
        
        # Get role information if role_id exists
        if "role_id" in user_dict and user_dict["role_id"]:
            try:
                role = await db.roles.find_one({"_id": ObjectId(user_dict["role_id"])})
                if role:
                    role = serialize_id(role)
                    user_dict["role"] = role["name"]
            except:
                user_dict["role"] = "Unknown"
        else:
            user_dict["role"] = "No Role"
        
        return user_dict
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: str = Path(..., description="The ID of the user to delete"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Delete an admin user
    """
    db = get_database()
    
    # Check if user exists
    user = await db.users.find_one({"_id": user_id, "is_admin": True})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found"
        )
    
    # Prevent self-deletion
    if user_id == admin_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Delete the user
    await db.users.delete_one({"_id": user_id})

@router.put("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    role_data: Dict[str, str],
    user_id: str = Path(..., description="The ID of the user"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Update a user's role
    """
    db = get_database()
    
    # Check if user exists
    user = await db.users.find_one({"_id": user_id, "is_admin": True})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found"
        )
    
    # Validate role ID
    role_id = role_data.get("role_id")
    if not role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role ID is required"
        )
    
    # Check if role exists
    try:
        role = await db.roles.find_one({"_id": ObjectId(role_id)})
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role ID format: {str(e)}"
        )
    
    # Update user role
    update_data = {
        "role_id": role_id,
        "updated_at": datetime.utcnow()
    }
    
    try:
        await db.users.update_one(
            {"_id": user_id},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await db.users.find_one({"_id": user_id})
        updated_user = serialize_id(updated_user)
        
        # Remove sensitive information
        if "hashed_password" in updated_user:
            del updated_user["hashed_password"]
        
        # Add role name
        role = serialize_id(role)
        updated_user["role"] = role["name"]
        
        return updated_user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user role: {str(e)}"
        )

@router.get("/users/{user_id}/activity", response_model=List[Dict[str, Any]])
async def get_user_activity(
    user_id: str = Path(..., description="The ID of the user to get activity for"),
    include_uploads: bool = Query(True, description="Include document uploads in activity"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """
    Get activity for a specific user, including document uploads
    """
    db = get_database()
    activities = []
    
    try:
        # Get documents uploaded by this user
        if include_uploads:
            # First get all alumni profiles for this user
            alumni_profiles = await db.alumni.find({"user_id": user_id}).to_list(None)
            alumni_ids = [profile["_id"] for profile in alumni_profiles]
            
            if alumni_ids:
                # Get documents for all alumni profiles of this user
                document_cursor = db.documents.find(
                    {"alumni_id": {"$in": alumni_ids}},
                    sort=[("created_at", -1)],
                    limit=limit
                )
                
                async for doc in document_cursor:
                    # Get the alumni profile for the document
                    alumni = next((a for a in alumni_profiles if a["_id"] == doc["alumni_id"]), None)
                    
                    activity = {
                        "id": str(doc["_id"]),
                        "type": "document_upload",
                        "timestamp": doc["created_at"].isoformat(),
                        "status": doc["verification_status"],
                        "document_type": doc["document_type"],
                        "document_title": doc["title"],
                        "description": f"You uploaded a {doc['document_type']}",
                        "data": {
                            "document_id": str(doc["_id"]),
                            "document_type": doc["document_type"],
                            "document_title": doc["title"]
                        }
                    }
                    
                    activities.append(activity)
        
        # Sort by timestamp (newest first)
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        # Return only the requested limit
        return activities[:limit]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user activity: {str(e)}"
        )

@router.post("/users/{user_id}/profile-picture", response_model=Dict[str, str])
async def upload_profile_picture(
    user_id: str = Path(..., description="The ID of the user to update"),
    profile_picture: UploadFile = File(...),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Upload a profile picture for a user
    """
    db = get_database()
    
    # Check if user exists
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Make sure the uploads directory exists
    upload_dir = os.path.join("uploads", "profile_pictures")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate a unique filename for the profile picture
    file_extension = os.path.splitext(profile_picture.filename)[1]
    unique_filename = f"{user_id}_{uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save profile picture: {str(e)}"
        )
    
    # Update the user record with the profile picture path
    relative_path = os.path.join("uploads", "profile_pictures", unique_filename)
    normalized_path = relative_path.replace("\\", "/")  # Normalize for web paths
    
    try:
        await db.users.update_one(
            {"_id": user_id},
            {"$set": {
                "profile_picture": normalized_path,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {"profile_picture": normalized_path}
    except Exception as e:
        # Try to clean up the file if the DB update fails
        try:
            os.remove(file_path)
        except:
            pass
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user with profile picture: {str(e)}"
        ) 