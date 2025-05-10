from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import os
import shutil
from pathlib import Path

from app.schemas import (
    AlumniCreate, 
    AlumniUpdate, 
    AlumniOut, 
    AlumniSearchParams, 
    AlumniSearchResult,
    ProfilePictureUpload
)
from app.utils.auth import get_current_user, get_admin_user
from app.config.database import get_database

router = APIRouter(prefix="/alumni", tags=["Alumni"])

# Health check endpoint
@router.get("/health", response_model=Dict[str, Any])
async def alumni_health_check():
    """
    Simple health check endpoint for the alumni API without authentication
    """
    # Check database connection
    db = get_database()
    db_status = "ok"
    collection_names = []
    alumni_count = 0
    error_details = None
    
    try:
        # Try to get collection names
        collection_names = await db.list_collection_names()
        # Try to count alumni
        alumni_count = await db.alumni.count_documents({})
    except Exception as e:
        db_status = "error"
        error_details = str(e)
    
    return {
        "status": "ok",
        "database_status": db_status,
        "collection_names": collection_names,
        "alumni_count": alumni_count,
        "error_details": error_details,
        "timestamp": datetime.utcnow().isoformat()
    }

# Create alumni profile
@router.post("/", response_model=AlumniOut)
async def create_alumni_profile(
    profile_data: AlumniCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Check if user is creating their own profile
    if profile_data.user_id != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create profile for another user"
        )
    
    # Check if profile already exists
    existing_profile = await db.alumni.find_one({"user_id": profile_data.user_id})
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alumni profile already exists for this user"
        )
    
    # Create profile
    now = datetime.utcnow()
    
    # Pre-populate with user data if available
    if not profile_data.full_name and "full_name" in current_user:
        profile_data.full_name = current_user["full_name"]
    
    if not profile_data.email and "email" in current_user:
        profile_data.email = current_user["email"]
    
    if not profile_data.student_id and "student_id" in current_user:
        profile_data.student_id = current_user["student_id"]
    
    if not profile_data.graduation_year and "graduation_year" in current_user:
        profile_data.graduation_year = current_user["graduation_year"]
    
    new_profile = {
        "_id": str(ObjectId()),
        **profile_data.dict(),
        "created_at": now,
        "updated_at": now
    }
    
    # Insert profile to database
    result = await db.alumni.insert_one(new_profile)
    
    # Get the ID of the inserted document
    document_request_id = str(result.inserted_id)
    
    # Get verified documents (will be empty for new profile)
    documents = []
    verified_document_ids = []
    
    return {**new_profile, "id": new_profile["_id"], "verified_documents": verified_document_ids}

# Upload profile picture
@router.post("/{alumni_id}/profile-picture", response_model=AlumniOut)
async def upload_profile_picture(
    alumni_id: str,
    profile_picture: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    # Find alumni
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is updating their own profile
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this profile"
        )
    
    # Validate file
    if not profile_picture.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    allowed_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    file_extension = os.path.splitext(profile_picture.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension not allowed. Allowed extensions: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (limit to 5MB)
    file_size_limit = 5 * 1024 * 1024  # 5MB
    content = await profile_picture.read()
    await profile_picture.seek(0)  # Reset file pointer after reading
    
    if len(content) > file_size_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB"
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("uploads/profile_pictures")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # If profile already has a picture, delete the old one
    if alumni.get("profile_picture") and os.path.exists(alumni["profile_picture"]):
        try:
            os.remove(alumni["profile_picture"])
        except Exception as e:
            print(f"Failed to delete old profile picture: {e}")
    
    # Generate a unique file name to prevent overwriting or access conflicts
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_filename = f"{alumni_id}_{timestamp}{file_extension}"
    file_path = f"uploads/profile_pictures/{unique_filename}"
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Update profile with new picture
    await db.alumni.update_one(
        {"_id": alumni_id},
        {
            "$set": {
                "profile_picture": file_path,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Get updated profile
    updated_alumni = await db.alumni.find_one({"_id": alumni_id})
    
    # Get verified documents
    documents = await db.documents.find(
        {
            "alumni_id": alumni_id,
            "verification_status": "verified"
        }
    ).to_list(None)
    
    # Make sure all document IDs are strings
    verified_document_ids = [str(doc["_id"]) for doc in documents]
    
    return {**updated_alumni, "verified_documents": verified_document_ids}

# Get all alumni profiles (with pagination and search)
@router.get("/", response_model=AlumniSearchResult)
async def get_all_alumni(
    name: Optional[str] = Query(None, description="Search by name"),
    department: Optional[str] = Query(None, description="Filter by department"),
    course: Optional[str] = Query(None, description="Filter by course"),
    batch: Optional[str] = Query(None, description="Filter by batch"),
    graduation_year: Optional[int] = Query(None, description="Filter by graduation year"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    try:
        db = get_database()
        
        # Build query
        query = {}
        if name:
            query["$or"] = [
                {"full_name": {"$regex": name, "$options": "i"}},
                {"email": {"$regex": name, "$options": "i"}},
                {"student_id": {"$regex": name, "$options": "i"}}
            ]
        
        if department:
            query["department"] = department
        
        if course:
            query["course"] = course
            
        if batch:
            query["batch"] = batch
        
        if graduation_year:
            query["graduation_year"] = graduation_year
        
        # Get total count for pagination
        total = await db.alumni.count_documents(query)
        
        # Get alumni with pagination
        alumni_list = await db.alumni.find(query).skip(offset).limit(limit).to_list(None)
        
        # Get verified documents for each alumni
        results = []
        for alumni in alumni_list:
            try:
                documents = await db.documents.find(
                    {
                        "alumni_id": alumni["_id"],
                        "verification_status": "verified"
                    }
                ).to_list(None)
                
                # Make sure all document IDs are strings
                verified_document_ids = [str(doc["_id"]) for doc in documents]
                results.append({**alumni, "verified_documents": verified_document_ids})
            except Exception as e:
                # If there's an error with a specific alumni, log and continue
                print(f"Error processing alumni {alumni.get('_id')}: {str(e)}")
                # Add the alumni without documents
                results.append({**alumni, "verified_documents": []})
        
        return {
            "results": results,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        # Log the error and return a more helpful error response
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_all_alumni: {str(e)}\n{error_details}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching alumni data: {str(e)}"
        )

# Get alumni by user ID
@router.get("/user/{user_id}", response_model=AlumniOut)
async def get_alumni_by_user_id(user_id: str):
    db = get_database()
    
    # Find alumni by user_id
    alumni = await db.alumni.find_one({"user_id": user_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found for this user"
        )
    
    # Get verified documents
    documents = await db.documents.find(
        {
            "alumni_id": alumni["_id"],
            "verification_status": "verified"
        }
    ).to_list(None)
    
    # Make sure all document IDs are strings
    verified_document_ids = [str(doc["_id"]) for doc in documents]
    
    return {**alumni, "verified_documents": verified_document_ids}

# Get alumni by ID
@router.get("/{alumni_id}", response_model=AlumniOut)
async def get_alumni_profile(alumni_id: str):
    db = get_database()
    
    # Find alumni
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Get verified documents
    documents = await db.documents.find(
        {
            "alumni_id": alumni_id,
            "verification_status": "verified"
        }
    ).to_list(None)
    
    # Make sure all document IDs are strings
    verified_document_ids = [str(doc["_id"]) for doc in documents]
    
    return {**alumni, "verified_documents": verified_document_ids}

# Update alumni profile
@router.put("/{alumni_id}", response_model=AlumniOut)
async def update_alumni_profile(
    alumni_id: str,
    profile_data: AlumniUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    # Debug log for birthday field
    print(f"DEBUG - Received birthday: {profile_data.birthday}")
    if profile_data.birthday:
        print(f"DEBUG - Birthday type: {type(profile_data.birthday)}")
        print(f"DEBUG - Birthday repr: {repr(profile_data.birthday)}")
    
    db = get_database()
    
    # Find alumni
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is updating their own profile
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this profile"
        )
    
    # Remove None values from update data
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    # Update alumni
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.alumni.update_one(
            {"_id": alumni_id},
            {"$set": update_data}
        )
    
    # Get updated profile
    updated_alumni = await db.alumni.find_one({"_id": alumni_id})
    
    # Get verified documents
    documents = await db.documents.find(
        {
            "alumni_id": alumni_id,
            "verification_status": "verified"
        }
    ).to_list(None)
    
    # Make sure all document IDs are strings
    verified_document_ids = [str(doc["_id"]) for doc in documents]
    
    return {**updated_alumni, "verified_documents": verified_document_ids}

# Delete alumni profile (admin only)
@router.delete("/{alumni_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alumni_profile(
    alumni_id: str,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    db = get_database()
    
    # Find alumni
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Delete alumni
    await db.alumni.delete_one({"_id": alumni_id})
    
    # Also delete related documents
    await db.documents.delete_many({"alumni_id": alumni_id})
    
    # Delete profile picture if exists
    if alumni.get("profile_picture"):
        try:
            os.remove(alumni["profile_picture"])
        except Exception:
            # Ignore errors when deleting files
            pass 

# Simple alumni list endpoint for improved reliability
@router.get("/list", response_model=Dict[str, Any])
async def get_simple_alumni_list(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Simplified endpoint to get a list of alumni with basic pagination.
    This endpoint prioritizes reliability over features.
    """
    try:
        db = get_database()
        
        # Get total count
        total = await db.alumni.count_documents({})
        
        # Get alumni with pagination but minimal fields
        alumni_cursor = db.alumni.find(
            {},
            projection={
                "_id": 1, 
                "full_name": 1, 
                "email": 1,
                "student_id": 1,
                "department": 1,
                "course": 1,
                "graduation_year": 1,
                "profile_picture": 1
            }
        ).skip(offset).limit(limit)
        
        # Convert to list of dictionaries
        alumni_list = await alumni_cursor.to_list(length=limit)
        
        # Convert ObjectId to string for serialization
        for alumni in alumni_list:
            alumni["_id"] = str(alumni["_id"])
        
        return {
            "results": alumni_list,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        # Log the error and return a more helpful error response
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_simple_alumni_list: {str(e)}\n{error_details}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching alumni data: {str(e)}"
        ) 