from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    DIPLOMA = "diploma"
    TRANSCRIPT = "transcript"
    CERTIFICATE = "certificate"
    ID_CARD = "id_card"
    OTHER = "other"

class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class DocumentBase(BaseModel):
    alumni_id: str
    document_type: DocumentType
    title: str
    description: Optional[str] = None
    file_path: str
    file_hash: str
    
class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    document_type: Optional[DocumentType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    verification_status: Optional[VerificationStatus] = None
    verified_by: Optional[str] = None
    verification_date: Optional[datetime] = None
    blockchain_tx_id: Optional[str] = None
    
class DocumentInDB(DocumentBase):
    id: str = Field(..., alias="_id")
    verification_status: VerificationStatus = VerificationStatus.PENDING
    verified_by: Optional[str] = None
    verification_date: Optional[datetime] = None
    blockchain_tx_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True
        
class DocumentOut(DocumentInDB):
    pass

class VerificationRequest(BaseModel):
    document_id: str

class VerificationResponse(BaseModel):
    document_id: str
    is_verified: bool
    blockchain_data: Optional[Dict[str, Any]] = None
    verification_date: Optional[datetime] = None 