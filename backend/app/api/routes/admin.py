from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, UploadFile, File, Form, Request, Response
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import os
import shutil
from pathlib import Path as FilePath

from app.utils.auth import get_admin_user, get_current_user
from app.config.database import get_database
from app.schemas import VerificationStatus

router = APIRouter()

@router.get("/dashboard/health", response_model=Dict[str, Any])
async def admin_dashboard_health():
    """
    Simple health check endpoint for admin dashboard without authentication
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Admin dashboard API is operational"
    }

@router.get("/dashboard/stats", response_model=Dict[str, int])
async def get_dashboard_stats(
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get statistics for the admin dashboard
    """
    db = get_database()
    
    # Get total alumni count
    total_alumni = await db.alumni.count_documents({})
    
    # Get pending verifications count
    pending_verifications = await db.documents.count_documents({
        "verification_status": VerificationStatus.PENDING.value
    })
    
    # Get verified documents count
    verified_documents = await db.documents.count_documents({
        "verification_status": VerificationStatus.VERIFIED.value
    })
    
    # Get new registrations in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_registrations = await db.users.count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "totalAlumni": total_alumni,
        "pendingVerifications": pending_verifications,
        "verifiedDocuments": verified_documents,
        "newRegistrations": new_registrations
    }

@router.get("/dashboard/recent-activity", response_model=List[Dict[str, Any]])
async def get_recent_activity(
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    limit: int = Query(10, ge=1, le=50),
    _force_refresh: bool = False  # Added for debugging - doesn't change functionality
):
    """
    Get recent activity for the admin dashboard
    """
    logger = logging.getLogger(__name__)
    
    logger.info(f"Fetching recent activity, limit: {limit}, force_refresh: {_force_refresh}")
    
    db = get_database()
    
    # First check for recent user verifications from audit logs
    logger.info("Checking audit logs for user verifications")
    recent_user_verifications_cursor = db.audit_logs.find(
        {"action": "user_verification"},
        sort=[("timestamp", -1)],
        limit=limit
    )
    
    recent_user_verifications = []
    async for log in recent_user_verifications_cursor:
        # Log the verification activity we found
        logger.info(f"Found user verification log: {log}")
        
        # Get user details
        user_id = log.get("user_id")
        user = None
        if user_id:
            try:
                if isinstance(user_id, str):
                    # Try as string ID first
                    user = await db.users.find_one({"_id": user_id})
                    # If not found, try as ObjectId
                    if not user and len(user_id) == 24:
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception as e:
                logger.error(f"Error finding user by ID {user_id}: {e}")
        
        if user:
            verification = {
                "id": str(log["_id"]),  # Convert ObjectId to string
                "type": "user_verification",
                "user": user.get("full_name", user.get("email", "Unknown")),
                "timestamp": log["timestamp"].isoformat(),
                "status": "verified",
                "notes": log.get("notes", "")
            }
            recent_user_verifications.append(verification)
            logger.info(f"Added user verification to activities: {verification}")
        else:
            logger.warning(f"User not found for verification log: {log}")
    
    # Get recent verifications (both pending, verified, and rejected)
    recent_verifications_cursor = db.documents.find(
        {},
        sort=[("updated_at", -1)],
        limit=limit
    )
    
    recent_verifications = []
    async for doc in recent_verifications_cursor:
        # Get alumni info for the document
        alumni = await db.alumni.find_one({"_id": doc["alumni_id"]})
        
        verification = {
            "id": str(doc["_id"]),  # Convert ObjectId to string
            "type": "verification",
            "user": alumni["full_name"] if alumni else "Unknown",
            "document": doc["title"],
            "timestamp": doc["updated_at"].isoformat() if "updated_at" in doc else doc["created_at"].isoformat(),
            "status": doc["verification_status"]
        }
        recent_verifications.append(verification)
    
    # Get recent registrations
    recent_registrations_cursor = db.users.find(
        {},
        sort=[("created_at", -1)],
        limit=limit
    )
    
    recent_registrations = []
    async for user in recent_registrations_cursor:
        registration = {
            "id": str(user["_id"]),  # Convert ObjectId to string
            "type": "registration",
            "user": user.get("full_name", user.get("email", "Unknown")),
            "timestamp": user["created_at"].isoformat(),
            "status": "completed"
        }
        recent_registrations.append(registration)
    
    # Combine and sort by timestamp
    all_activities = recent_user_verifications + recent_verifications + recent_registrations
    all_activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Log the top activities we found
    logger.info(f"Found {len(all_activities)} total activities")
    if all_activities:
        logger.info(f"Top activity: {all_activities[0]}")
    
    # Return only the requested limit
    return all_activities[:limit]

@router.get("/verifications", response_model=List[Dict[str, Any]])
async def get_verification_requests(
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    status: str = Query("pending", enum=["pending", "approved", "rejected", "all"])
):
    """
    Get verification requests for admin review
    """
    db = get_database()
    
    # Build query based on status filter
    query = {}
    if status != "all":
        status_map = {
            "pending": VerificationStatus.PENDING.value,
            "approved": VerificationStatus.VERIFIED.value,
            "rejected": VerificationStatus.REJECTED.value
        }
        query["verification_status"] = status_map[status]
    
    # Get documents
    cursor = db.documents.find(
        query,
        sort=[("created_at", -1)]
    )
    
    result = []
    async for doc in cursor:
        # Get alumni info
        alumni = await db.alumni.find_one({"_id": doc["alumni_id"]})
        if not alumni:
            continue
        
        # Map status values to frontend expected values
        status_map = {
            VerificationStatus.PENDING.value: "pending",
            VerificationStatus.VERIFIED.value: "approved",
            VerificationStatus.REJECTED.value: "rejected"
        }
        
        verification_request = {
            "id": str(doc["_id"]),  # Convert ObjectId to string
            "studentName": alumni["full_name"],
            "studentId": alumni.get("student_id", ""),
            "documentType": doc["document_type"],
            "program": alumni.get("program", ""),
            "submissionDate": doc["created_at"].isoformat(),
            "status": status_map.get(doc["verification_status"], "pending"),
            "documentPreviewUrl": f"/api/v1/documents/{doc['_id']}/preview",
            "notes": doc.get("admin_notes", ""),
            "fileUrl": f"/api/v1/documents/{doc['_id']}/download"
        }
        result.append(verification_request)
    
    return result

@router.post("/verifications/{document_id}/approve", response_model=Dict[str, Any])
async def approve_verification(
    document_id: str,
    data: Dict[str, str],
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Approve a document verification
    """
    from app.routes.verification import verify_document
    from app.schemas import VerificationRequest
    
    # Create verification request
    verification_request = VerificationRequest(
        document_id=document_id,
        status=VerificationStatus.VERIFIED,
        admin_notes=data.get("admin_notes", "Verified and approved.")
    )
    
    # Use the existing verification endpoint
    result = await verify_document(verification_request, admin_user)
    return result

@router.post("/verifications/{document_id}/reject", response_model=Dict[str, Any])
async def reject_verification(
    document_id: str,
    data: Dict[str, str],
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Reject a document verification
    """
    from app.routes.verification import verify_document
    from app.schemas import VerificationRequest
    
    # Create verification request
    verification_request = VerificationRequest(
        document_id=document_id,
        status=VerificationStatus.REJECTED,
        admin_notes=data.get("admin_notes", "Document rejected due to verification issues.")
    )
    
    # Use the existing verification endpoint
    result = await verify_document(verification_request, admin_user)
    return result

@router.get("/recent-users", response_model=List[Dict[str, Any]])
async def get_recent_users(
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    days: int = Query(30, ge=1, le=90)
):
    """
    Get recent user registrations
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching recent users for past {days} days")
    
    db = get_database()
    
    # Calculate date range for recent users
    days_ago = datetime.utcnow() - timedelta(days=days)
    
    # Find recent users
    cursor = db.users.find(
        {"created_at": {"$gte": days_ago}},
        sort=[("created_at", -1)]
    )
    
    # Process users
    users = []
    async for user in cursor:
        # Log raw user data to debug field names
        logger.info(f"Raw user data for {user.get('email')}: {user}")
        
        # Check if there's a corresponding alumni record
        user_id = user.get("_id")
        alumni = None
        
        try:
            # First check if there's an alumni record with matching user_id
            if user_id:
                alumni = await db.alumni.find_one({"user_id": str(user_id)})
                
                if not alumni:
                    # Try with email as a fallback
                    alumni = await db.alumni.find_one({"email": user.get("email")})
                
                if alumni:
                    logger.info(f"Found alumni record for {user.get('email')}: {alumni}")
        except Exception as e:
            logger.error(f"Error finding alumni record: {e}")
        
        # Create a sanitized user object (no password)
        # Include both field name versions for compatibility
        graduation_year = user.get("graduation_year") or user.get("year_graduated")
        
        # If we found an alumni record, supplement missing user data with alumni data
        department = user.get("department", "")
        student_id = user.get("student_id", "")
        
        if alumni:
            # Supplement with alumni data if fields are missing in user data
            if not department and alumni.get("department"):
                department = alumni.get("department")
                logger.info(f"Using department from alumni record for {user.get('email')}: {department}")
                
            if not student_id and alumni.get("student_id"):
                student_id = alumni.get("student_id")
                logger.info(f"Using student_id from alumni record for {user.get('email')}: {student_id}")
                
            if not graduation_year and alumni.get("graduation_year"):
                graduation_year = alumni.get("graduation_year")
                logger.info(f"Using graduation_year from alumni record for {user.get('email')}: {graduation_year}")
        
        sanitized_user = {
            "id": str(user["_id"]),
            "_id": str(user["_id"]),
            "email": user["email"],
            "full_name": user.get("full_name", ""),
            "created_at": user["created_at"].isoformat() if "created_at" in user else None,
            "student_id": student_id,
            "department": department,
            # Include both field names for compatibility
            "graduation_year": graduation_year,
            "year_graduated": graduation_year,
            "is_verified": user.get("is_verified", False),
            "is_admin": user.get("is_admin", False),
            "last_login": user.get("last_login", None)
        }
        users.append(sanitized_user)
        
        # Log which fields are missing for this user
        missing_fields = []
        for field in ["full_name", "student_id", "department"]:
            if not sanitized_user.get(field):
                missing_fields.append(field)
        if not sanitized_user.get("graduation_year"):
            missing_fields.append("graduation_year/year_graduated")
            
        if missing_fields:
            logger.info(f"User {user.get('email')} is missing fields: {', '.join(missing_fields)}")
        else:
            logger.info(f"User {user.get('email')} has a complete profile")
    
    logger.info(f"Found {len(users)} recent users")
    return users

# Admin profile endpoints
@router.get("/profile", response_model=Dict[str, Any])
async def get_admin_profile(current_user: Any = Depends(get_admin_user)):
    """
    Get the admin user's profile information
    """
    logger = logging.getLogger(__name__)
    
    # Handle both dictionary and object user models
    user_data = {}
    if isinstance(current_user, dict):
        # If current_user is already a dictionary
        user_data = current_user
        logger.info(f"Admin profile requested for user {current_user.get('email')}")
    else:
        # If current_user is an object with attributes
        try:
            # Convert object to dictionary
            user_data = {
                "_id": str(getattr(current_user, "_id", getattr(current_user, "id", ""))),
                "id": str(getattr(current_user, "id", getattr(current_user, "_id", ""))),
                "email": getattr(current_user, "email", ""),
                "first_name": getattr(current_user, "first_name", ""),
                "last_name": getattr(current_user, "last_name", ""),
                "full_name": getattr(current_user, "full_name", ""),
                "employee_id": getattr(current_user, "employee_id", ""),
                "department": getattr(current_user, "department", ""),
                "position": getattr(current_user, "position", ""),
                "phone": getattr(current_user, "phone", ""),
                "address": getattr(current_user, "address", ""),
                "bio": getattr(current_user, "bio", ""),
                "profile_picture": getattr(current_user, "profile_picture", ""),
                "is_admin": getattr(current_user, "is_admin", True)
            }
            logger.info(f"Admin profile requested for user {getattr(current_user, 'email', 'unknown')}")
        except Exception as e:
            logger.error(f"Error converting user object to dictionary: {str(e)}")
            # Return a fallback dictionary with minimal data
            user_data = {"error": "Could not retrieve user data"}
    
    # Ensure full_name is present in the response
    if "full_name" not in user_data or not user_data["full_name"]:
        # Try to construct full_name from first_name and last_name
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")
        if first_name or last_name:
            user_data["full_name"] = f"{first_name} {last_name}".strip()
    
    # Return the admin user profile data
    return user_data

@router.put("/profile", response_model=Dict[str, Any])
async def update_admin_profile(
    profile_data: Dict[str, Any],
    current_user: Any = Depends(get_admin_user)
):
    """
    Update the admin user's profile information
    """
    logger = logging.getLogger(__name__)
    
    # Get user ID from either dictionary or object
    user_id = None
    user_email = ""
    
    if isinstance(current_user, dict):
        user_id = current_user.get("_id")
        user_email = current_user.get("email", "")
    else:
        user_id = getattr(current_user, "_id", getattr(current_user, "id", None))
        user_email = getattr(current_user, "email", "")
    
    if not user_id:
        logger.error("Cannot update user profile - missing user ID")
        raise HTTPException(status_code=400, detail="Invalid user data")
    
    logger.info(f"Admin profile update for user {user_email}")
    
    # Get database connection
    from app.config.database import get_database
    db = get_database()
    
    # Make sure we don't update any security-sensitive fields
    safe_fields = [
        "full_name", "email", "department", "position", 
        "phone", "address", "bio", "employee_id"
    ]
    
    # Filter out any unsafe fields
    update_data = {k: profile_data[k] for k in safe_fields if k in profile_data}
    
    # Add updated_at timestamp
    update_data["updated_at"] = datetime.utcnow()
    
    # If full_name is provided, update first_name and last_name as well
    if "full_name" in update_data:
        full_name = update_data["full_name"]
        name_parts = full_name.split(" ", 1)
        if len(name_parts) > 1:
            update_data["first_name"] = name_parts[0]
            update_data["last_name"] = name_parts[1]
        else:
            update_data["first_name"] = full_name
            update_data["last_name"] = ""
    
    # Update the user in the database
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        logger.warning(f"Admin profile update failed - no document modified")
        raise HTTPException(status_code=400, detail="Profile update failed")
    
    # Get the updated user
    updated_user = await db.users.find_one({"_id": user_id})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found after update")
    
    # Ensure the response includes full_name
    if "first_name" in updated_user and "last_name" in updated_user and "full_name" not in updated_user:
        updated_user["full_name"] = f"{updated_user['first_name']} {updated_user['last_name']}".strip()
    
    return updated_user

@router.post("/profile/upload-picture", response_model=Dict[str, Any])
async def upload_admin_profile_picture(
    profile_picture: UploadFile = File(...),
    current_user: Any = Depends(get_admin_user)
):
    """
    Upload a profile picture for the admin user
    """
    logger = logging.getLogger(__name__)
    
    # Get user ID from either dictionary or object
    user_id = None
    user_email = ""
    
    if isinstance(current_user, dict):
        user_id = current_user.get("_id")
        user_email = current_user.get("email", "")
    else:
        user_id = getattr(current_user, "_id", getattr(current_user, "id", None))
        user_email = getattr(current_user, "email", "")
    
    if not user_id:
        logger.error("Cannot upload profile picture - missing user ID")
        raise HTTPException(status_code=400, detail="Invalid user data")
    
    logger.info(f"Admin profile picture upload for user {user_email}")
    
    # Get database connection
    from app.config.database import get_database
    db = get_database()
    
    # Validate file type
    if not profile_picture.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create uploads directory if it doesn't exist
    upload_dir = FilePath("uploads/profile_pictures")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate a unique filename based on user ID and timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    file_extension = profile_picture.filename.split(".")[-1]
    filename = f"admin_{user_id}_{timestamp}.{file_extension}"
    
    # Save the file
    file_path = upload_dir / filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(profile_picture.file, buffer)
    
    # Update the user's profile_picture field in the database
    db_path = f"uploads/profile_pictures/{filename}"
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "profile_picture": db_path,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        logger.warning(f"Admin profile picture update failed - no document modified")
        raise HTTPException(status_code=400, detail="Profile picture update failed")
    
    # Get the updated user
    updated_user = await db.users.find_one({"_id": user_id})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found after update")
    
    return {"message": "Profile picture uploaded successfully", "profile_picture": db_path}

# CORS OPTIONS handlers for admin profile endpoints
@router.options("/profile", include_in_schema=False)
async def options_admin_profile(request: Request, response: Response):
    """Handle OPTIONS requests for the admin profile endpoint"""
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Admin-Bypass, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.options("/profile/upload-picture", include_in_schema=False)
async def options_admin_profile_upload(request: Request, response: Response):
    """Handle OPTIONS requests for the admin profile picture upload endpoint"""
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Admin-Bypass, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {} 