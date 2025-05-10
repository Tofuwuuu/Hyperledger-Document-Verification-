from fastapi import APIRouter, HTTPException, Depends, status, File, UploadFile, Query, Form
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import json
from bson import ObjectId
from enum import Enum

from app.schemas import (
    VerificationRequest,
    VerificationResponse,
    VerificationStatus,
    PublicVerificationRequest,
    PublicVerificationResponse
)
from app.utils.auth import get_current_user, get_admin_user
from app.config.database import get_database, get_transaction_session
from app.blockchain.fabric import (
    generate_document_hash,
    store_document_hash,
    verify_document_hash,
    get_document_history
)
from app.services.notification_service import notify_document_verification, notify_blockchain_confirmation

router = APIRouter(prefix="/verification", tags=["Verification"])

# Verify document by ID (admin only)
@router.post("/verify", response_model=Dict[str, Any])
async def verify_document(
    verification_data: VerificationRequest,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    db = get_database()
    document_id = verification_data.document_id
    
    # Find document
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Find alumni to get user ID for notification
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    if not alumni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumni profile not found"
        )
    
    # Get user ID for notifications
    user_id = alumni["user_id"]
    
    # Check if document status is valid
    if verification_data.status != VerificationStatus.VERIFIED and verification_data.status != VerificationStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification status: {verification_data.status}"
        )
    
    # Check if document is already in the requested state
    if document["verification_status"] == verification_data.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is already {verification_data.status}"
        )
    
    # If verifying, store in blockchain
    if verification_data.status == VerificationStatus.VERIFIED:
        metadata = {
            "document_id": document_id,
            "alumni_id": document["alumni_id"],
            "document_type": document["document_type"],
            "title": document["title"],
            "verified_by": str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"]),
            "verification_date": datetime.utcnow().isoformat(),
            "admin_notes": verification_data.admin_notes
        }
        
        # Store in blockchain - this can't be rolled back so do it before starting the transaction
        blockchain_result = await store_document_hash(
            document_id=document_id,
            document_hash=document["file_hash"],
            metadata=metadata
        )
        
        if not blockchain_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store document hash in blockchain: {blockchain_result['message']}"
            )
        
        # Start a transaction for database updates and notifications
        now = datetime.utcnow()
        transaction_id = blockchain_result.get("transaction_id", "unknown")
        
        try:
            # Use transaction for database operations
            async with get_transaction_session() as session:
                async with session.start_transaction():
                    # Update document status within transaction
                    await db.documents.update_one(
                        {"_id": document_id},
                        {
                            "$set": {
                                "verification_status": verification_data.status.value,
                                "verified_by": str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"]),
                                "verification_date": now,
                                "blockchain_tx_id": transaction_id,
                                "admin_notes": verification_data.admin_notes,
                                "updated_at": now
                            }
                        },
                        session=session
                    )
                    
                    # Add verification history record
                    await db.verification_history.insert_one({
                        "document_id": document_id,
                        "alumni_id": document["alumni_id"],
                        "user_id": user_id,
                        "status": verification_data.status.value,
                        "verified_by": str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"]),
                        "verification_date": now,
                        "blockchain_tx_id": transaction_id,
                        "admin_notes": verification_data.admin_notes,
                        "created_at": now
                    }, session=session)
                    
                    # The notifications are now moved outside the transaction as they might involve
                    # external services that can't be rolled back in MongoDB transactions
        
            # Send notifications after transaction completes
            await notify_document_verification(
                document_id=document_id,
                document_title=document["title"],
                status="verified",
                user_id=user_id,
                admin_notes=verification_data.admin_notes
            )
            
            await notify_blockchain_confirmation(
                document_id=document_id,
                document_title=document["title"],
                user_id=user_id,
                transaction_id=transaction_id
            )
            
            return {
                "success": True,
                "message": "Document successfully verified",
                "document_id": document_id,
                "transaction_id": transaction_id,
                "verification_date": now.isoformat()
            }
            
        except Exception as e:
            # If we get here, the transaction was rolled back
            # But the blockchain operation can't be rolled back
            return {
                "success": False,
                "message": f"Database update failed: {str(e)}",
                "blockchain_status": "Document hash was stored in blockchain but database update failed",
                "transaction_id": transaction_id
            }
    
    # If rejecting, use transaction for database operations
    else:
        now = datetime.utcnow()
        try:
            async with get_transaction_session() as session:
                async with session.start_transaction():
                    # Update document status within transaction
                    await db.documents.update_one(
                        {"_id": document_id},
                        {
                            "$set": {
                                "verification_status": verification_data.status.value,
                                "verified_by": str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"]),
                                "verification_date": now,
                                "admin_notes": verification_data.admin_notes,
                                "updated_at": now
                            }
                        },
                        session=session
                    )
                    
                    # Add verification history record
                    await db.verification_history.insert_one({
                        "document_id": document_id,
                        "alumni_id": document["alumni_id"],
                        "user_id": user_id,
                        "status": verification_data.status.value,
                        "verified_by": str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"]),
                        "verification_date": now,
                        "admin_notes": verification_data.admin_notes,
                        "created_at": now
                    }, session=session)
            
            # Send notification after transaction completes
            await notify_document_verification(
                document_id=document_id,
                document_title=document["title"],
                status="rejected",
                user_id=user_id,
                admin_notes=verification_data.admin_notes
            )
            
            return {
                "success": True,
                "message": "Document verification rejected",
                "document_id": document_id,
                "rejection_reason": verification_data.admin_notes,
                "rejection_date": now.isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Database update failed: {str(e)}"
            }

# Check document verification by ID (public)
@router.get("/check/{document_id}", response_model=VerificationResponse)
async def check_verification(document_id: str):
    db = get_database()
    
    # Find document
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # If document is not verified, return status
    if document["verification_status"] != VerificationStatus.VERIFIED.value:
        return {
            "document_id": document_id,
            "is_verified": False,
            "blockchain_data": None,
            "verification_date": None,
            "admin_notes": document.get("admin_notes")
        }
    
    # Check verification in blockchain
    blockchain_result = await verify_document_hash(
        document_id=document_id,
        document_hash=document["file_hash"]
    )
    
    if not blockchain_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify document hash in blockchain: {blockchain_result['message']}"
        )
    
    # Get alumni information for the response
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    issuer = "CVSU Carmona"
    
    return {
        "document_id": document_id,
        "is_verified": blockchain_result["verified"],
        "blockchain_data": blockchain_result["data"] if blockchain_result["verified"] else None,
        "verification_date": document.get("verification_date"),
        "issuer": issuer,
        "admin_notes": document.get("admin_notes")
    }

# Verify document by file upload (public)
@router.post("/check-by-file", response_model=PublicVerificationResponse)
async def verify_by_file(file: UploadFile = File(...)):
    """Verify a document by uploading the file and checking its hash"""
    # Read file content
    file_content = await file.read()
    
    # Generate hash
    file_hash = generate_document_hash(file_content)
    
    db = get_database()
    
    # Find document by hash
    document = await db.documents.find_one({"file_hash": file_hash})
    if not document:
        return {
            "is_verified": False,
            "document_info": None,
            "alumni_info": None,
            "verification_date": None,
            "blockchain_proof": None,
            "issuer": "CVSU Carmona"
        }
    
    # If document is not verified, return status
    if document["verification_status"] != VerificationStatus.VERIFIED.value:
        return {
            "is_verified": False,
            "document_info": {
                "document_id": document["_id"],
                "document_type": document["document_type"],
                "title": document["title"]
            },
            "alumni_info": None,
            "verification_date": None,
            "blockchain_proof": None,
            "issuer": "CVSU Carmona"
        }
    
    # Check verification in blockchain
    blockchain_result = await verify_document_hash(
        document_id=document["_id"],
        document_hash=file_hash
    )
    
    # Get alumni information
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    alumni_info = None
    if alumni:
        alumni_info = {
            "full_name": alumni["full_name"],
            "student_id": alumni["student_id"],
            "graduation_year": alumni["graduation_year"],
            "department": alumni["department"],
            "course": alumni["course"]
        }
    
    return {
        "is_verified": blockchain_result["verified"],
        "document_info": {
            "document_id": document["_id"],
            "document_type": document["document_type"],
            "title": document["title"],
            "description": document.get("description"),
            "verification_status": document["verification_status"]
        },
        "alumni_info": alumni_info,
        "verification_date": document.get("verification_date"),
        "blockchain_proof": document.get("blockchain_tx_id"),
        "issuer": "CVSU Carmona"
    }

# Verify document by hash (public)
@router.post("/check-by-hash", response_model=PublicVerificationResponse)
async def verify_by_hash(verification_data: PublicVerificationRequest):
    """Verify a document by providing its hash"""
    db = get_database()
    
    # Find document by hash
    document = await db.documents.find_one({"file_hash": verification_data.document_hash})
    if not document:
        return {
            "is_verified": False,
            "document_info": None,
            "alumni_info": None,
            "verification_date": None,
            "blockchain_proof": None,
            "issuer": "CVSU Carmona"
        }
    
    # If document is not verified, return status
    if document["verification_status"] != VerificationStatus.VERIFIED.value:
        return {
            "is_verified": False,
            "document_info": {
                "document_id": document["_id"],
                "document_type": document["document_type"],
                "title": document["title"]
            },
            "alumni_info": None,
            "verification_date": None,
            "blockchain_proof": None,
            "issuer": "CVSU Carmona"
        }
    
    # Check verification in blockchain
    blockchain_result = await verify_document_hash(
        document_id=document["_id"],
        document_hash=verification_data.document_hash
    )
    
    # Get alumni information
    alumni = await db.alumni.find_one({"_id": document["alumni_id"]})
    alumni_info = None
    if alumni:
        alumni_info = {
            "full_name": alumni["full_name"],
            "student_id": alumni["student_id"],
            "graduation_year": alumni["graduation_year"],
            "department": alumni["department"],
            "course": alumni["course"]
        }
    
    return {
        "is_verified": blockchain_result["verified"],
        "document_info": {
            "document_id": document["_id"],
            "document_type": document["document_type"],
            "title": document["title"],
            "description": document.get("description"),
            "verification_status": document["verification_status"]
        },
        "alumni_info": alumni_info,
        "verification_date": document.get("verification_date"),
        "blockchain_proof": document.get("blockchain_tx_id"),
        "issuer": "CVSU Carmona"
    }

# Get document history from blockchain (admin only)
@router.get("/history/{document_id}", response_model=Dict[str, Any])
async def document_history(
    document_id: str,
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
    
    # If document is not verified, there's no blockchain history
    if document["verification_status"] != VerificationStatus.VERIFIED.value:
        return {
            "success": False,
            "message": "Document is not verified and has no blockchain history",
            "history": []
        }
    
    # Get history from blockchain
    result = await get_document_history(document_id=document_id)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get document history from blockchain: {result['message']}"
        )
    
    return {
        "success": True,
        "document_id": document_id,
        "file_hash": document["file_hash"],
        "history": result["history"]
    } 