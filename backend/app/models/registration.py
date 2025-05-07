from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId
from app.models.common import PyObjectId

class RegistrationStatus:
    REGISTERED = "registered"
    CONFIRMED = "confirmed"
    ATTENDED = "attended"
    NO_SHOW = "no-show"
    CANCELLED = "cancelled"

class AttendanceStatus:
    PENDING = "pending"
    ATTENDED = "attended"
    EXCUSED = "excused"
    NO_SHOW = "no-show"

class RegistrationBase(BaseModel):
    event_id: Union[PyObjectId, str]
    user_id: Union[PyObjectId, str]
    status: str = RegistrationStatus.REGISTERED
    
    @field_validator('event_id', 'user_id', mode='before')
    @classmethod
    def validate_object_id(cls, v):
        if isinstance(v, str):
            return PyObjectId(v)
        elif isinstance(v, ObjectId):
            return PyObjectId(v)
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }

class RegistrationCreate(RegistrationBase):
    pass

class RegistrationUpdate(BaseModel):
    status: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_in_by: Optional[PyObjectId] = None
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }

class RegistrationInDB(RegistrationBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    qr_code_data: str
    check_in_time: Optional[datetime] = None
    check_in_by: Optional[PyObjectId] = None
    attendance_status: str = AttendanceStatus.PENDING
    attendance_time: Optional[datetime] = None
    student_id: Optional[PyObjectId] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }
        
    def dict(self, **kwargs):
        """Custom dict method that handles ObjectIds properly."""
        exclude_none = kwargs.get('exclude_none', False)
        by_alias = kwargs.get('by_alias', False)
        
        # Get dictionary from parent method
        doc = super().dict(**kwargs)
        
        # Convert _id to string if it exists
        if "_id" in doc and doc["_id"] is not None:
            doc["_id"] = str(doc["_id"])
            
        # Also convert id to string if it exists
        if "id" in doc and doc["id"] is not None:
            doc["id"] = str(doc["id"])
        
        # Convert ObjectId fields to strings
        for field in ['event_id', 'user_id', 'check_in_by', 'student_id']:
            if field in doc and doc[field] is not None:
                doc[field] = str(doc[field])
            
        # Filter out None values if exclude_none is True
        if exclude_none:
            return {k: v for k, v in doc.items() if v is not None}
            
        return doc

class Registration(RegistrationInDB):
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }

class RegistrationWithUser(Registration):
    user_name: str
    user_email: str
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    } 