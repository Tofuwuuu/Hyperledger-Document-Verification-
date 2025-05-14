from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, date
from bson import ObjectId
import os
import shutil
from pathlib import Path
import logging
import asyncio

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
from app.utils.datetime_utils import ensure_timezone_aware, get_aware_current_datetime

router = APIRouter(prefix="/alumni", tags=["Alumni"])
logger = logging.getLogger(__name__)

# Helper function to ensure datetime objects have timezone info
def ensure_timezone(dt):
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# Utility function for retrying database operations
async def db_operation_with_retry(operation, max_retries=3):
    """Execute a database operation with retry logic"""
    retries = 0
    while retries < max_retries:
        try:
            result = await operation()
            return result
        except Exception as e:
            retries += 1
            if retries >= max_retries:
                logger.error(f"Operation failed after {max_retries} attempts: {str(e)}")
                raise
            logger.warning(f"Retry {retries}/{max_retries} after error: {str(e)}")
            await asyncio.sleep(0.5 * retries)  # Exponential backoff

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
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Create alumni profile
@router.post("/", response_model=AlumniOut)
async def create_alumni_profile(
    profile_data: AlumniCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    logger.debug(f"Creating alumni profile for user_id: {profile_data.user_id}")
    
    # Check if user is creating their own profile
    if profile_data.user_id != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create profile for another user"
        )
    
    # Check if profile already exists - use retry logic
    async def find_existing_profile():
        return await db.alumni.find_one({"user_id": profile_data.user_id})
    
    try:
        existing_profile = await db_operation_with_retry(find_existing_profile)
        if existing_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alumni profile already exists for this user"
            )
    except Exception as e:
        logger.error(f"Error checking for existing profile: {str(e)}")
        # Continue anyway - we'll try to create the profile
        
    # Create profile
    now = get_aware_current_datetime()
    
    # Pre-populate with user data if available
    if not profile_data.full_name and "full_name" in current_user:
        profile_data.full_name = current_user["full_name"]
    
    if not profile_data.email and "email" in current_user:
        profile_data.email = current_user["email"]
    
    if not profile_data.student_id and "student_id" in current_user:
        profile_data.student_id = current_user["student_id"]
    
    if not profile_data.graduation_year and "graduation_year" in current_user:
        profile_data.graduation_year = current_user["graduation_year"]
    
    # Convert profile data to dict and handle any datetime fields
    profile_dict = profile_data.dict()
    
    # Ensure all datetime fields have timezone info (except birthday which is a date)
    for key, value in profile_dict.items():
        if isinstance(value, datetime) and key != 'birthday':
            profile_dict[key] = ensure_timezone_aware(value)
    
    # Process nested datetime fields
    if 'work_experience' in profile_dict and profile_dict['work_experience']:
        for i, exp in enumerate(profile_dict['work_experience']):
            if 'start_date' in exp and exp['start_date']:
                profile_dict['work_experience'][i]['start_date'] = ensure_timezone_aware(exp['start_date'])
            if 'end_date' in exp and exp['end_date']:
                profile_dict['work_experience'][i]['end_date'] = ensure_timezone_aware(exp['end_date'])
    
    if 'achievements' in profile_dict and profile_dict['achievements']:
        for i, achievement in enumerate(profile_dict['achievements']):
            if 'date' in achievement and achievement['date']:
                profile_dict['achievements'][i]['date'] = ensure_timezone_aware(achievement['date'])
    
    new_profile = {
        "_id": str(ObjectId()),
        **profile_dict,
        "created_at": now,
        "updated_at": now
    }
    
    # Check if all required fields for completion are present
    profile_completed = check_profile_completion(new_profile)
    new_profile["profile_completed"] = profile_completed
    
    try:
        # Insert profile to database with retry logic
        async def insert_profile():
            return await db.alumni.insert_one(new_profile)
            
        result = await db_operation_with_retry(insert_profile)
        
        # Get verified documents (will be empty for new profile)
        documents = []
        verified_document_ids = []
        
        logger.debug(f"Successfully created alumni profile with ID: {new_profile['_id']}")
        
        return {**new_profile, "id": new_profile["_id"], "verified_documents": verified_document_ids}
    except Exception as e:
        logger.error(f"Error creating alumni profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create alumni profile: {str(e)}"
        )

# Upload profile picture
@router.post("/{alumni_id}/profile-picture", response_model=AlumniOut)
async def upload_profile_picture(
    alumni_id: str,
    profile_picture: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    try:
        # Find alumni with retry
        async def find_alumni():
            return await db.alumni.find_one({"_id": alumni_id})
            
        alumni = await db_operation_with_retry(find_alumni)
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
                logger.warning(f"Failed to delete old profile picture: {e}")
        
        # Generate a unique file name to prevent overwriting or access conflicts
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_filename = f"{alumni_id}_{timestamp}{file_extension}"
        file_path = f"uploads/profile_pictures/{unique_filename}"
        
        # Save file
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(content)
        except Exception as e:
            logger.error(f"Failed to save profile picture: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save profile picture"
            )
        
        # Update profile with new picture
        update_time = get_aware_current_datetime()
        
        try:
            async def update_profile():
                return await db.alumni.update_one(
                    {"_id": alumni_id},
                    {
                        "$set": {
                            "profile_picture": file_path,
                            "updated_at": update_time
                        }
                    }
                )
                
            await db_operation_with_retry(update_profile)
        except Exception as e:
            logger.error(f"Failed to update profile with new picture: {e}")
            # Try to clean up the file if we couldn't update the database
            try:
                os.remove(file_path)
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile with new picture"
            )
        
        # Get updated profile
        try:
            async def get_profile():
                return await db.alumni.find_one({"_id": alumni_id})
                
            updated_alumni = await db_operation_with_retry(get_profile)
            
            # Make sure required fields exist with default values if missing
            for field in ["department", "course", "batch"]:
                if field not in updated_alumni or updated_alumni[field] is None:
                    updated_alumni[field] = ""
        except Exception as e:
            logger.error(f"Failed to retrieve updated profile: {e}")
            # Return a basic response rather than failing
            updated_alumni = {
                **alumni,
                "profile_picture": file_path,
                "updated_at": update_time
            }
        
        # Get verified documents
        verified_document_ids = []
        try:
            async def get_documents():
                return await db.documents.find(
                    {
                        "alumni_id": alumni_id,
                        "verification_status": "verified"
                    }
                ).to_list(None)
                
            documents = await db_operation_with_retry(get_documents)
            # Make sure all document IDs are strings
            verified_document_ids = [str(doc["_id"]) for doc in documents]
        except Exception as e:
            logger.error(f"Error getting verified documents: {str(e)}")
        
        return {**updated_alumni, "verified_documents": verified_document_ids}
    except HTTPException:
        # Reraise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_profile_picture: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

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
        try:
            total = await db.alumni.count_documents(query)
        except Exception as count_error:
            print(f"Error counting alumni documents: {str(count_error)}")
            # Default to 0 for total if count fails
            total = 0
        
        # Get alumni with pagination
        try:
            alumni_list = await db.alumni.find(query).skip(offset).limit(limit).to_list(None)
        except Exception as find_error:
            print(f"Error finding alumni documents: {str(find_error)}")
            # Return empty list if find fails
            return {
                "results": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Get verified documents for each alumni
        results = []
        for alumni in alumni_list:
            try:
                # Convert _id to string to ensure proper serialization
                alumni["_id"] = str(alumni["_id"])
                
                # Try to get documents, but handle failure gracefully
                try:
                    documents = await db.documents.find(
                        {
                            "alumni_id": alumni["_id"],
                            "verification_status": "verified"
                        }
                    ).to_list(None)
                    
                    # Make sure all document IDs are strings
                    verified_document_ids = [str(doc["_id"]) for doc in documents]
                except Exception as doc_error:
                    print(f"Error fetching documents for alumni {alumni.get('_id')}: {str(doc_error)}")
                    verified_document_ids = []
                
                results.append({**alumni, "verified_documents": verified_document_ids})
            except Exception as e:
                # If there's an error with a specific alumni, log and continue
                print(f"Error processing alumni {alumni.get('_id')}: {str(e)}")
                # Try to add the alumni without documents but with minimal processing
                try:
                    results.append({
                        "_id": str(alumni.get("_id", "unknown")),
                        "full_name": alumni.get("full_name", "Unknown"),
                        "verified_documents": []
                    })
                except:
                    # If even that fails, just skip this alumni
                    pass
        
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
        
        # Return an empty result instead of raising an exception
        # This ensures the frontend always gets a valid response
        return {
            "results": [],
            "total": 0,
            "limit": limit,
            "offset": offset
        }

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

# Get alumni by user ID
@router.get("/user/{user_id}", response_model=AlumniOut)
async def get_alumni_by_user_id(user_id: str):
    db = get_database()
    
    try:
        # Find alumni by user_id with retry
        async def find_alumni():
            return await db.alumni.find_one({"user_id": user_id})
            
        alumni = await db_operation_with_retry(find_alumni)
        if not alumni:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alumni profile not found for this user"
            )
        
        # Make sure required fields exist with default values if missing
        for field in ["department", "course", "batch"]:
            if field not in alumni or alumni[field] is None:
                alumni[field] = ""
        
        # Verify profile completion status
        profile_completed = check_profile_completion(alumni)
        if alumni.get("profile_completed") != profile_completed:
            # Update profile completion status if it's inconsistent
            try:
                await db.alumni.update_one(
                    {"_id": alumni["_id"]},
                    {"$set": {"profile_completed": profile_completed}}
                )
                alumni["profile_completed"] = profile_completed
            except Exception as e:
                logger.warning(f"Failed to update profile completion status: {str(e)}")
        
        # Get verified documents
        try:
            async def get_documents():
                return await db.documents.find(
                    {
                        "alumni_id": alumni["_id"],
                        "verification_status": "verified"
                    }
                ).to_list(None)
                
            documents = await db_operation_with_retry(get_documents)
            # Make sure all document IDs are strings
            verified_document_ids = [str(doc["_id"]) for doc in documents]
        except Exception as e:
            logger.error(f"Error getting verified documents: {str(e)}")
            verified_document_ids = []
        
        return {**alumni, "verified_documents": verified_document_ids}
    except HTTPException:
        # Reraise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving alumni profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the alumni profile"
        )

# Get alumni by ID
@router.get("/{alumni_id}", response_model=AlumniOut)
async def get_alumni_profile(alumni_id: str):
    db = get_database()
    
    try:
        # Find alumni with retry
        async def find_alumni():
            return await db.alumni.find_one({"_id": alumni_id})
            
        alumni = await db_operation_with_retry(find_alumni)
        if not alumni:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alumni profile not found"
            )
        
        # Make sure required fields exist with default values if missing
        for field in ["department", "course", "batch"]:
            if field not in alumni or alumni[field] is None:
                alumni[field] = ""
        
        # Verify profile completion status
        profile_completed = check_profile_completion(alumni)
        if alumni.get("profile_completed") != profile_completed:
            # Update profile completion status if it's inconsistent
            try:
                await db.alumni.update_one(
                    {"_id": alumni_id},
                    {"$set": {"profile_completed": profile_completed}}
                )
                alumni["profile_completed"] = profile_completed
            except Exception as e:
                logger.warning(f"Failed to update profile completion status: {str(e)}")
        
        # Get verified documents
        try:
            async def get_documents():
                return await db.documents.find(
                    {
                        "alumni_id": alumni_id,
                        "verification_status": "verified"
                    }
                ).to_list(None)
                
            documents = await db_operation_with_retry(get_documents)
            # Make sure all document IDs are strings
            verified_document_ids = [str(doc["_id"]) for doc in documents]
        except Exception as e:
            logger.error(f"Error getting verified documents: {str(e)}")
            verified_document_ids = []
        
        return {**alumni, "verified_documents": verified_document_ids}
    except HTTPException:
        # Reraise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving alumni profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the alumni profile"
        )

# Function to check if a profile has all required fields completed
def check_profile_completion(profile_data: Dict[str, Any]) -> bool:
    """
    Check if an alumni profile has all the required fields completed
    Returns True if complete, False otherwise
    """
    required_fields = [
        "full_name", 
        "student_id", 
        "email", 
        "department", 
        "course", 
        "batch", 
        "graduation_year"
    ]
    
    for field in required_fields:
        # Check if field exists and has a non-empty value
        if field not in profile_data or not profile_data[field]:
            return False
    
    return True

# Update alumni profile
@router.put("/{alumni_id}", response_model=AlumniOut)
async def update_alumni_profile(
    alumni_id: str,
    profile_data: AlumniUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    # Debug log for birthday field
    logger.debug(f"Received birthday: {profile_data.birthday}")
    if profile_data.birthday:
        logger.debug(f"Birthday type: {type(profile_data.birthday)}")
        logger.debug(f"Birthday repr: {repr(profile_data.birthday)}")
    
    db = get_database()
    
    # Find alumni with retry
    async def find_alumni():
        return await db.alumni.find_one({"_id": alumni_id})
        
    try:
        alumni = await db_operation_with_retry(find_alumni)
        if not alumni:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alumni profile not found"
            )
    except Exception as e:
        logger.error(f"Error finding alumni profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error when finding alumni: {str(e)}"
        )
    
    # Check if user is updating their own profile
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this profile"
        )
    
    # Remove None values from update data
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    # Process datetime fields to ensure they have timezone info (except birthday which is a date)
    datetime_fields = []  # birthday is now a date field and doesn't need timezone conversion
    for field in datetime_fields:
        if field in update_data and update_data[field] is not None:
            update_data[field] = ensure_timezone_aware(update_data[field])
    
    # Handle nested datetime fields (work_experience dates)
    if 'work_experience' in update_data and update_data['work_experience']:
        for i, exp in enumerate(update_data['work_experience']):
            if 'start_date' in exp and exp['start_date']:
                update_data['work_experience'][i]['start_date'] = ensure_timezone_aware(exp['start_date'])
            if 'end_date' in exp and exp['end_date']:
                update_data['work_experience'][i]['end_date'] = ensure_timezone_aware(exp['end_date'])
    
    # Handle nested datetime fields (achievements dates)
    if 'achievements' in update_data and update_data['achievements']:
        for i, achievement in enumerate(update_data['achievements']):
            if 'date' in achievement and achievement['date']:
                update_data['achievements'][i]['date'] = ensure_timezone_aware(achievement['date'])
    
    # Update alumni
    if update_data:
        update_data["updated_at"] = get_aware_current_datetime()
        
        # Check if the profile has all required fields now
        merged_profile = {**alumni, **update_data}
        profile_completed = check_profile_completion(merged_profile)
        update_data["profile_completed"] = profile_completed
        
        try:
            # Use retry mechanism for the update
            async def update_alumni_profile_db():
                return await db.alumni.update_one(
                    {"_id": alumni_id},
                    {"$set": update_data}
                )
                
            await db_operation_with_retry(update_alumni_profile_db)
        except Exception as e:
            logger.error(f"Error updating alumni profile: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update alumni profile: {str(e)}"
            )
    
    # Get updated profile with retry
    async def get_updated_alumni():
        return await db.alumni.find_one({"_id": alumni_id})
        
    try:
        updated_alumni = await db_operation_with_retry(get_updated_alumni)
    except Exception as e:
        logger.error(f"Error getting updated alumni profile: {str(e)}")
        # Return the alumni we already have plus the updates, rather than failing
        updated_alumni = {**alumni, **update_data}
    
    # Get verified documents with retry
    verified_document_ids = []
    try:
        async def get_documents():
            return await db.documents.find(
                {
                    "alumni_id": alumni_id,
                    "verification_status": "verified"
                }
            ).to_list(None)
            
        documents = await db_operation_with_retry(get_documents)
        # Make sure all document IDs are strings
        verified_document_ids = [str(doc["_id"]) for doc in documents]
    except Exception as e:
        logger.error(f"Error getting verified documents: {str(e)}")
        # Continue without documents rather than failing the whole request
    
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

# Simplified endpoint for creating alumni profiles
@router.post("/simple", response_model=Dict[str, Any])
async def create_simple_alumni_profile(
    profile_data: dict,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Simplified endpoint for creating alumni profiles with minimal validation"""
    db = get_database()
    
    # Only require essential fields
    required_fields = ["user_id", "full_name", "email", "student_id", "graduation_year"]
    for field in required_fields:
        if field not in profile_data:
            return {
                "success": False,
                "message": f"Missing required field: {field}",
                "field": field
            }
    
    try:
        # Check if user is creating their own profile
        if profile_data["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
            return {
                "success": False,
                "message": "Not authorized to create profile for another user"
            }
        
        # Check if profile already exists
        existing_profile = await db.alumni.find_one({"user_id": profile_data["user_id"]})
        if existing_profile:
            return {
                "success": False,
                "message": "Alumni profile already exists for this user",
                "profile_id": existing_profile["_id"]
            }
        
        # Create profile with minimal processing
        now = datetime.now(timezone.utc)
        new_profile = {
            "_id": str(ObjectId()),
            **profile_data,
            "created_at": now,
            "updated_at": now
        }
        
        # Handle any date fields
        if "birthday" in new_profile and isinstance(new_profile["birthday"], str):
            try:
                # Just store the date portion
                new_profile["birthday"] = new_profile["birthday"].split("T")[0]
            except Exception as e:
                logger.warning(f"Error formatting birthday: {str(e)}")
        
        # Check if all required fields for completion are present
        profile_completed = check_profile_completion(new_profile)
        new_profile["profile_completed"] = profile_completed
        
        # Insert with retry
        async def insert_operation():
            return await db.alumni.insert_one(new_profile)
        
        result = await db_operation_with_retry(insert_operation)
        
        return {
            "success": True, 
            "id": new_profile["_id"],
            "message": "Profile created successfully",
            "profile_completed": profile_completed
        }
    except Exception as e:
        logger.error(f"Error in simple profile creation: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Profile creation failed, but request was received"
        }

# Simplified endpoint for updating alumni profiles
@router.put("/{alumni_id}/simple", response_model=Dict[str, Any])
async def update_simple_alumni_profile(
    alumni_id: str,
    update_data: dict,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Simplified endpoint for updating alumni profiles with minimal validation"""
    db = get_database()
    
    try:
        # Basic authorization check
        alumni = await db.alumni.find_one({"_id": alumni_id})
        if not alumni:
            return {"success": False, "message": "Alumni not found"}
            
        if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
            return {"success": False, "message": "Not authorized"}
        
        # Handle any date fields
        if "birthday" in update_data and isinstance(update_data["birthday"], str):
            try:
                # Just store the date portion
                update_data["birthday"] = update_data["birthday"].split("T")[0]
            except Exception as e:
                logger.warning(f"Error formatting birthday: {str(e)}")
        
        # Update with minimal processing
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Check if the profile has all required fields now
        merged_profile = {**alumni, **update_data}
        profile_completed = check_profile_completion(merged_profile)
        update_data["profile_completed"] = profile_completed
        
        # Update with retry
        async def update_operation():
            return await db.alumni.update_one(
                {"_id": alumni_id},
                {"$set": update_data}
            )
        
        await db_operation_with_retry(update_operation)
        
        return {
            "success": True,
            "message": "Profile updated successfully",
            "profile_completed": profile_completed
        }
    except Exception as e:
        logger.error(f"Error in simple profile update: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Profile update failed, but request was received"
        }

# Fix for the standard POST /alumni endpoint
@router.post("")
async def create_alumni_profile_alias(
    profile_data: AlumniCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Alias for create_alumni_profile to ensure compatibility with frontend API client"""
    logger.info("Using create_alumni_profile_alias endpoint")
    return await create_alumni_profile(profile_data, current_user) 