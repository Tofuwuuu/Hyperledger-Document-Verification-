from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.common import PyObjectId

class DocumentRequestStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"

class DocumentRequestType(str, Enum):
    GOOD_MORAL = "good_moral"
    CERTIFICATION = "certification" 
    ENROLLMENT = "enrollment"

class DocumentRequestCreate(BaseModel):
    document_type: DocumentRequestType
    purpose: Optional[str] = None

class DocumentRequestBase(BaseModel):
    alumni_id: str
    document_type: DocumentRequestType
    purpose: Optional[str] = None
    status: DocumentRequestStatus = DocumentRequestStatus.PENDING
    
class DocumentRequest(DocumentRequestBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    document_id: Optional[str] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, PyObjectId: str}

class DocumentRequestUpdate(BaseModel):
    status: Optional[DocumentRequestStatus] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    document_id: Optional[str] = None

class DocumentRequestOut(DocumentRequest):
    # Additional fields for frontend display
    alumni_name: Optional[str] = None
    student_id: Optional[str] = None
    course: Optional[str] = None
    graduation_year: Optional[int] = None 