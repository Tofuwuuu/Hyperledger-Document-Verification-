"""
Verification models for document verification API
"""

from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime


class DocumentVerifyRequest(BaseModel):
    """Request model for document verification against database."""
    document_id: str
    hash: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentVerificationResult(BaseModel):
    """Result model for document verification."""
    success: bool
    verified: bool
    document_id: str
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BlockchainVerifyRequest(BaseModel):
    """Request model for blockchain document verification."""
    document_id: str
    hash: str
    verifier: Optional[str] = None


class BlockchainStoreRequest(BaseModel):
    """Request model for storing document on blockchain."""
    document_id: str
    hash: str
    metadata: Optional[Dict[str, Any]] = None


class BlockchainVerificationResult(BaseModel):
    """Result model for blockchain verification."""
    success: bool
    verified: bool
    document_id: str
    transaction_id: Optional[str] = None
    message: Optional[str] = None


class DocumentHistoryEntry(BaseModel):
    """Model for document history entry."""
    transaction_id: str
    timestamp: datetime
    action: str
    user: str
    metadata: Optional[Dict[str, Any]] = None


class DocumentHistoryResult(BaseModel):
    """Result model for document history."""
    success: bool
    document_id: str
    history: List[DocumentHistoryEntry]
    message: Optional[str] = None