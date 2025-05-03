from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import os
from pathlib import Path

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
from app.repositories.factory import get_document_repository
from app.config.database import get_database
from app.blockchain.fabric import generate_document_hash
from app.config.db_init import audit_log

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
    document_repo = await get_document_repository()
    
    # Verify alumni exists
    alumni = await db.alumni.find_one({"_id": alumni_id})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Check if user is uploading document for their own profile
    if alumni["user_id"] != current_user["_id"] and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload documents for this alumni"
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path(f"uploads/documents/{alumni_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate file path
    file_extension = os.path.splitext(file.filename)[1]
    file_name = f"{document_type.value}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{file_extension}"
    file_path = f"uploads/documents/{alumni_id}/{file_name}"
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        # Reset for hash computation
        file.file.seek(0)
    
    # Generate document hash
    file_content = await file.read()
    file_hash = generate_document_hash(file_content)
    
    # Create document record
    document_data = {
        "alumni_id": alumni_id,
        "document_type": document_type.value,
        "title": title,
        "description": description,
        "file_path": file_path,
        "file_hash": file_hash,
        "verification_status": VerificationStatus.PENDING.value
    }
    
    # Insert document to database
    document_id = await document_repo.create(document_data)
    
    # Log the action
    await audit_log(
        action="document_uploaded",
        user_id=current_user["_id"],
        details={"document_id": document_id, "document_type": document_type.value}
    )
    
    # Get the created document
    new_document = await document_repo.find_by_id(document_id)
    return new_document

# Get all documents for an alumni
@router.get("/alumni/{alumni_id}", response_model=List[DocumentOut])
async def get_alumni_documents(
    alumni_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    document_repo = await get_document_repository()
    
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
    documents = await document_repo.find_by_alumni_id(alumni_id)
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
    document_repo = await get_document_repository()
    
    # If not admin, restrict to owned documents or verified documents
    if not current_user.get("is_admin", False):
        # Get all alumni IDs for this user
        alumni = await db.alumni.find({"user_id": current_user["_id"]}).to_list(None)
        alumni_ids = [a["_id"] for a in alumni]
        
        # Call search with the user's alumni IDs for restriction
        search_results = await document_repo.search_documents(
            alumni_id=alumni_id,
            document_type=document_type,
            verification_status=verification_status,
            skip=offset,
            limit=limit
        )
        
        # Filter results to only include the user's documents or verified ones
        if not alumni_ids:
            # If user has no alumni profiles, only show verified documents
            filtered_results = [doc for doc in search_results["results"] 
                              if doc["verification_status"] == VerificationStatus.VERIFIED.value]
        else:
            filtered_results = [doc for doc in search_results["results"] 
                              if doc["alumni_id"] in alumni_ids or 
                                 doc["verification_status"] == VerificationStatus.VERIFIED.value]
        
        search_results["results"] = filtered_results
        search_results["total"] = len(filtered_results)
        
        return search_results
    else:
        # Admin can see all documents
        return await document_repo.search_documents(
            alumni_id=alumni_id,
            document_type=document_type,
            verification_status=verification_status,
            skip=offset,
            limit=limit
        )

# Get document by ID
@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    document_repo = await get_document_repository()
    
    # Find document
    document = await document_repo.find_by_id(document_id)
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
    
    return document

# Get all pending documents (admin only)
@router.get("/pending/all", response_model=List[DocumentOut])
async def get_all_pending_documents(
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    document_repo = await get_document_repository()
    
    # Get all pending documents
    pending_documents = await document_repo.find_pending_documents(limit=100)
    return pending_documents 