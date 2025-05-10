from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator, HttpUrl
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    DIPLOMA = "diploma"
    TRANSCRIPT = "transcript"
    CERTIFICATE = "certificate"
    ID_CARD = "id_card"
    OTHER = "other"
    
    @classmethod
    def values(cls):
        return [member.value for member in cls]

class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    
    @classmethod
    def values(cls):
        return [member.value for member in cls]

class DocumentBase(BaseModel):
    alumni_id: str = Field(..., description="ID of the alumni who owns this document")
    document_type: DocumentType = Field(..., description="Type of document")
    title: str = Field(..., min_length=3, max_length=100, description="Document title")
    description: Optional[str] = Field(None, max_length=500, description="Document description")
    file_path: str = Field(..., min_length=5, description="Path to the stored document file")
    file_hash: str = Field(..., min_length=32, description="Hash of the document file for verification")
    
    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @validator('file_hash')
    def validate_file_hash(cls, v):
        if not v or len(v) < 32:
            raise ValueError('Invalid file hash')
        return v

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    document_type: Optional[DocumentType] = Field(None, description="Type of document")
    title: Optional[str] = Field(None, min_length=3, max_length=100, description="Document title")
    description: Optional[str] = Field(None, max_length=500, description="Document description")
    file_path: Optional[str] = Field(None, min_length=5, description="Path to the stored document file")
    file_hash: Optional[str] = Field(None, min_length=32, description="Hash of the document file for verification")
    verification_status: Optional[VerificationStatus] = Field(None, description="Document verification status")
    verified_by: Optional[str] = Field(None, description="ID of admin who verified this document")
    verification_date: Optional[datetime] = Field(None, description="Date when the document was verified")
    blockchain_tx_id: Optional[str] = Field(None, description="Blockchain transaction ID for this verification")
    
    @validator('title')
    def validate_title(cls, v):
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @validator('file_hash')
    def validate_file_hash(cls, v):
        if v is None:
            return v
        if not v or len(v) < 32:
            raise ValueError('Invalid file hash')
        return v
    
    @validator('verification_status')
    def validate_status(cls, v, values):
        if v == VerificationStatus.VERIFIED and 'verified_by' not in values:
            raise ValueError('Verified documents must include the ID of the admin who verified them')
        return v

class DocumentInDB(DocumentBase):
    id: str = Field(..., alias="_id", description="Document ID")
    verification_status: VerificationStatus = Field(VerificationStatus.PENDING, description="Document verification status")
    verified_by: Optional[str] = Field(None, description="ID of admin who verified this document")
    verification_date: Optional[datetime] = Field(None, description="Date when the document was verified")
    blockchain_tx_id: Optional[str] = Field(None, description="Blockchain transaction ID for this verification")
    created_at: datetime = Field(..., description="Document creation timestamp")
    updated_at: datetime = Field(..., description="Document last update timestamp")
    
    model_config = {
        "populate_by_name": True
    }

class DocumentOut(DocumentInDB):
    pass

class DocumentSearchParams(BaseModel):
    alumni_id: Optional[str] = Field(None, description="Filter by alumni ID")
    document_type: Optional[DocumentType] = Field(None, description="Filter by document type")
    verification_status: Optional[VerificationStatus] = Field(None, description="Filter by verification status")
    limit: Optional[int] = Field(10, ge=1, le=100, description="Maximum number of results")
    offset: Optional[int] = Field(0, ge=0, description="Pagination offset")

class DocumentSearchResult(BaseModel):
    results: List[DocumentOut] = Field(..., description="List of documents matching search criteria")
    total: int = Field(..., description="Total number of matching documents")
    limit: int = Field(..., description="Maximum number of results per page")
    offset: int = Field(..., description="Current pagination offset")

class DocumentUpload(BaseModel):
    alumni_id: str = Field(..., description="Alumni ID")
    document_type: DocumentType = Field(..., description="Type of document")
    title: str = Field(..., min_length=3, max_length=100, description="Document title")
    description: Optional[str] = Field(None, max_length=500, description="Document description")
    
    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

class VerificationRequest(BaseModel):
    document_id: str = Field(..., description="ID of the document to verify")
    status: VerificationStatus = Field(..., description="New verification status")
    admin_notes: Optional[str] = Field(None, max_length=500, description="Notes from the admin verifying the document")
    
    @validator('status')
    def validate_status(cls, v):
        if v == VerificationStatus.PENDING:
            raise ValueError('Cannot set status back to pending')
        return v

class VerificationResponse(BaseModel):
    document_id: str = Field(..., description="Document ID")
    is_verified: bool = Field(..., description="Whether the document is verified")
    blockchain_data: Optional[Dict[str, Any]] = Field(None, description="Data retrieved from the blockchain")
    verification_date: Optional[datetime] = Field(None, description="Date of verification")
    issuer: Optional[str] = Field(None, description="Name of the issuing institution")
    admin_notes: Optional[str] = Field(None, description="Notes from the admin who verified the document")

class PublicVerificationRequest(BaseModel):
    document_hash: str = Field(..., min_length=32, description="Hash of the document to verify")
    
    @validator('document_hash')
    def validate_document_hash(cls, v):
        if not v or len(v) < 32:
            raise ValueError('Invalid document hash')
        return v

class PublicVerificationResponse(BaseModel):
    is_verified: bool = Field(..., description="Whether the document is verified")
    document_info: Optional[Dict[str, Any]] = Field(None, description="Basic information about the verified document")
    alumni_info: Optional[Dict[str, str]] = Field(None, description="Basic information about the document owner")
    verification_date: Optional[datetime] = Field(None, description="Date of verification")
    blockchain_proof: Optional[str] = Field(None, description="Blockchain transaction ID for verification")
    issuer: str = Field("CVSU Carmona", description="Name of the issuing institution") 