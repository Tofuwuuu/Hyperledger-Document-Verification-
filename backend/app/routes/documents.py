from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import os
import shutil
from pathlib import Path
import hashlib
import uuid

from app.schemas import (
    DocumentCreate,
    DocumentUpdate,
    DocumentOut,
    DocumentUpload,
    DocumentType,
    DocumentSearchParams,
    DocumentSearchResult,
    VerificationStatus
)
from app.utils.auth import get_current_user, get_admin_user
from app.config.database import get_database
from app.blockchain.fabric import generate_document_hash
from app.services.notification_service import create_notification, NotificationTypes

router = APIRouter(prefix="/documents", tags=["Documents"])

# Upload document
@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    alumni_id: str = Form(...),
    document_type: DocumentType = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Verify alumni exists
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user owns the alumni profile
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload documents for this alumni"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Calculate file hash
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # Generate a unique filename
    filename = f"{document_type.value}_{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
    
    # Create upload directory if it doesn't exist
    upload_dir = os.path.join("documents", alumni_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Create document in database
    now = datetime.utcnow()
    document = {
        "_id": str(uuid.uuid4()),
        "alumni_id": alumni_id,
        "document_type": document_type.value,
        "title": title,
        "description": description,
        "file_name": filename,
        "file_path": file_path,
        "file_hash": file_hash,
        "verification_status": VerificationStatus.PENDING.value,
        "created_at": now,
        "updated_at": now
    }
    
    await db.documents.insert_one(document)
    
    # Send notification to user
    await create_notification(
        user_id=current_user["_id"],
        notification_type=NotificationTypes.DOCUMENT_UPLOADED,
        message=f"Document '{title}' has been uploaded and is pending verification.",
        document_id=document["_id"],
        document_title=title,
        additional_data={
            "status": VerificationStatus.PENDING.value,
            "document_type": document_type.value
        }
    )
    
    return document

# Get all documents for an alumni
@router.get("/alumni/{alumni_id}", response_model=List[DocumentOut])
async def get_alumni_documents(
    alumni_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Verify alumni exists
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is viewing their own documents or is an admin
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view documents for this alumni"
        )
    
    # Get documents
    documents = await db.documents.find({"alumni_id": alumni_id}).to_list(None)
    
    # Ensure all _id fields are strings to pass validation
    for doc in documents:
        if "_id" in doc and not isinstance(doc["_id"], str):
            doc["_id"] = str(doc["_id"])
        
        # Add admin name for verified documents
        if doc.get("verification_status") == "verified" and doc.get("verified_by"):
            try:
                admin = await db.users.find_one({"_id": doc["verified_by"]})
                if admin:
                    admin_name = admin.get("full_name", "Unknown Admin")
                    admin_position = admin.get("position", "")
                    
                    if admin_position:
                        doc["verified_by_name"] = f"{admin_name} - {admin_position}"
                    else:
                        doc["verified_by_name"] = admin_name
            except Exception as e:
                print(f"Error fetching admin details: {e}")
                doc["verified_by_name"] = "System"
    
    return documents

# Search documents with filters
@router.get("/search", response_model=DocumentSearchResult)
async def search_documents(
    alumni_id: Optional[str] = Query(None, description="Filter by alumni ID"),
    document_type: Optional[DocumentType] = Query(None, description="Filter by document type"),
    verification_status: Optional[VerificationStatus] = Query(None, description="Filter by verification status"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Build query
    query = {}
    
    if alumni_id:
        query["alumni_id"] = alumni_id
    
    if document_type:
        query["document_type"] = document_type.value
    
    if verification_status:
        query["verification_status"] = verification_status.value
    
    # If not admin, restrict to owned documents or verified documents
    if not current_user.get("is_admin", False):
        # Get all alumni IDs for this user
        alumni = await db.alumni.find({"user_id": current_user["_id"]}).to_list(None)
        alumni_ids = [a["_id"] for a in alumni]
        
        if alumni_ids:
            query["$or"] = [
                {"alumni_id": {"$in": alumni_ids}},
                {"verification_status": VerificationStatus.VERIFIED.value}
            ]
        else:
            # If user has no alumni profiles, only show verified documents
            query["verification_status"] = VerificationStatus.VERIFIED.value
    
    # Get total count for pagination
    total = await db.documents.count_documents(query)
    
    # Get documents with pagination
    documents = await db.documents.find(query).skip(offset).limit(limit).to_list(None)
    
    # Ensure all _id fields are strings to pass validation
    for doc in documents:
        if "_id" in doc and not isinstance(doc["_id"], str):
            doc["_id"] = str(doc["_id"])
    
    return {
        "results": documents,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# Get document activities for a user
@router.get("/activities", response_model=List[Dict[str, Any]])
async def get_document_activities(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """
    Get document upload activities for the current user
    """
    db = get_database()
    activities = []
    
    try:
        print(f"Fetching activities for user: {current_user['_id']}")
        
        # First get all alumni profiles for this user
        alumni_profiles = await db.alumni.find({"user_id": current_user["_id"]}).to_list(None)
        print(f"Found {len(alumni_profiles)} alumni profiles")
        
        alumni_ids = [profile["_id"] for profile in alumni_profiles]
        
        if alumni_ids:
            print(f"Alumni IDs: {alumni_ids}")
            
            # Get documents for all alumni profiles of this user
            document_cursor = db.documents.find(
                {"alumni_id": {"$in": alumni_ids}},
                sort=[("created_at", -1)],
                limit=limit
            )
            
            documents = []
            async for doc in document_cursor:
                documents.append(doc)
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
            
            print(f"Found {len(documents)} documents")
        else:
            print("No alumni profiles found - cannot fetch documents")
        
        # Also fetch user activities (like exit interviews)
        user_activities_cursor = db.user_activities.find(
            {"user_id": str(current_user["_id"])},
            sort=[("timestamp", -1)],
            limit=limit
        )
        
        user_activities = []
        async for activity in user_activities_cursor:
            activities.append({
                "id": str(activity["_id"]),
                "type": activity["type"],
                "timestamp": activity["timestamp"].isoformat(),
                "description": activity["description"],
                "data": activity.get("metadata", {})
            })
            
        print(f"Found {len(user_activities)} user activities")
        
        # Sort all activities by timestamp
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        # Return activities
        print(f"Returning {len(activities)} total activities")
        return activities[:limit]
        
    except Exception as e:
        print(f"Error in get_document_activities: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching document activities: {str(e)}"
        )

# Get all pending documents (admin only)
@router.get("/pending/all", response_model=List[DocumentOut])
async def get_all_pending_documents(
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    db = get_database()
    
    # Get all pending documents
    documents = await db.documents.find({"verification_status": VerificationStatus.PENDING.value}).to_list(None)
    
    # Ensure all _id fields are strings to pass validation
    for doc in documents:
        if "_id" in doc and not isinstance(doc["_id"], str):
            doc["_id"] = str(doc["_id"])
    
    return documents

# Get document by ID
@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Find document
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify alumni exists
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is viewing their own document or is an admin
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        # If document is verified, anyone can view it
        if document["verification_status"] != VerificationStatus.VERIFIED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this document"
            )
    
    # Ensure _id field is a string to pass validation
    if "_id" in document and not isinstance(document["_id"], str):
        document["_id"] = str(document["_id"])
    
    # Add admin name for verified documents
    if document.get("verification_status") == "verified" and document.get("verified_by"):
        try:
            admin = await db.users.find_one({"_id": document["verified_by"]})
            if admin:
                admin_name = admin.get("full_name", "Unknown Admin")
                admin_position = admin.get("position", "")
                
                if admin_position:
                    document["verified_by_name"] = f"{admin_name} - {admin_position}"
                else:
                    document["verified_by_name"] = admin_name
        except Exception as e:
            print(f"Error fetching admin details: {e}")
            document["verified_by_name"] = "System"
    
    return document

# Update document (admin only)
@router.put("/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: str,
    document_data: DocumentUpdate,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    db = get_database()
    
    # Find document
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Remove None values from update data
    update_data = {k: v for k, v in document_data.dict().items() if v is not None}
    
    # If updating status to verified, add verification info
    if update_data.get("verification_status") == VerificationStatus.VERIFIED:
        if "verified_by" not in update_data:
            update_data["verified_by"] = admin_user["_id"]
            
            # Add admin name information directly when verifying
            admin_name = admin_user.get("full_name", "Unknown Admin")
            admin_position = admin_user.get("position", "")
            
            if admin_position:
                update_data["verified_by_name"] = f"{admin_name} - {admin_position}"
            else:
                update_data["verified_by_name"] = admin_name
                
        if "verification_date" not in update_data:
            update_data["verification_date"] = datetime.utcnow()
    
    # Update document
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": update_data}
        )
    
    # Get updated document
    updated_document = await db.documents.find_one({"_id": document_id})
    
    # Ensure _id field is a string to pass validation
    if "_id" in updated_document and not isinstance(updated_document["_id"], str):
        updated_document["_id"] = str(updated_document["_id"])
    
    return updated_document

# Delete document
@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # Find document
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify alumni exists
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is deleting their own document or is an admin
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this document"
        )
    
    # Delete document
    await db.documents.delete_one({"_id": document_id})
    
    # Delete file
    if os.path.exists(document["file_path"]):
        try:
            os.remove(document["file_path"])
        except Exception:
            # Ignore errors when deleting files
            pass 