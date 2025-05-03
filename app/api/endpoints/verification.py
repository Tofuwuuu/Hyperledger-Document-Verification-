"""
Document Verification API endpoints
"""

import json
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Optional, List

from app.models.verification import (
    DocumentVerifyRequest,
    DocumentVerificationResult,
    BlockchainVerifyRequest,
    BlockchainStoreRequest
)
from app.services.blockchain_manager import get_blockchain_manager
from app.utils.auth import get_current_user
from app.utils.documents import calculate_hash

router = APIRouter(prefix="/verification", tags=["Verification"])

# Document verification endpoints
@router.post("/verify")
async def verify_document(
    request: DocumentVerifyRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Verify a document against database records."""
    # Implementation for database verification
    pass

# Blockchain verification endpoints
@router.post("/blockchain/verify")
async def verify_document_blockchain(
    request: BlockchainVerifyRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Verify a document against the blockchain."""
    try:
        # Get blockchain manager
        blockchain_mgr = get_blockchain_manager()
        
        # Set verifier if not provided
        verifier = request.verifier or current_user.get("username", "unknown")
        
        # Verify document
        result = await blockchain_mgr.verify_document(
            request.document_id, 
            request.hash
        )
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Verification failed")}
            )
        
        return {
            "success": True,
            "verified": result.get("verified", False),
            "document_id": request.document_id
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain verification error: {str(e)}"}
        )

@router.post("/blockchain/store")
async def store_document_blockchain(
    request: BlockchainStoreRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Store a document hash on the blockchain."""
    try:
        # Get blockchain manager
        blockchain_mgr = get_blockchain_manager()
        
        # Prepare metadata
        metadata = request.metadata or {}
        
        # Add user info to metadata
        metadata.update({
            "stored_by": current_user.get("username", "unknown"),
            "user_id": current_user.get("_id", "unknown")
        })
        
        # Store document
        result = await blockchain_mgr.store_document(
            request.document_id, 
            request.hash, 
            metadata
        )
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Failed to store document")}
            )
        
        return {
            "success": True,
            "transaction_id": result.get("transaction_id", "unknown"),
            "document_id": request.document_id,
            "hash": request.hash
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain storage error: {str(e)}"}
        )

@router.get("/blockchain/history/{document_id}")
async def get_document_history_blockchain(
    document_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get document verification history from the blockchain."""
    try:
        # Get blockchain manager
        blockchain_mgr = get_blockchain_manager()
        
        # Get document history
        result = await blockchain_mgr.get_document_history(document_id)
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Failed to get document history")}
            )
        
        return {
            "success": True,
            "history": result.get("history", []),
            "document_id": document_id
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain history error: {str(e)}"}
        )

@router.post("/blockchain/verify-file")
async def verify_document_by_file_blockchain(
    document_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Verify a document by file against the blockchain."""
    try:
        # Get blockchain manager
        blockchain_mgr = get_blockchain_manager()
        
        # Read file content
        file_content = await file.read()
        
        # Calculate hash
        document_hash = blockchain_mgr.calculate_document_hash(file_content)
        
        # Verify document
        result = await blockchain_mgr.verify_document(
            document_id, 
            document_hash
        )
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Verification failed")}
            )
        
        return {
            "success": True,
            "verified": result.get("verified", False),
            "document_id": document_id,
            "hash": document_hash
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain verification error: {str(e)}"}
        ) 