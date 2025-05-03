from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

from app.models.common import PyObjectId


class AttendanceBase(BaseModel):
    """Base model for attendance records."""
    event_token: str
    name: str
    email: EmailStr
    mobile: Optional[str] = None
    department: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    """Model for creating a new attendance record."""
    pass


class Attendance(AttendanceBase):
    """Full attendance model with ID and timestamps."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    student_id: Optional[PyObjectId] = None
    event_id: Optional[PyObjectId] = None
    registration_id: Optional[PyObjectId] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {PyObjectId: str}
        schema_extra = {
            "example": {
                "_id": "60d21b4967d0d8992e610c85",
                "event_token": "abc123",
                "name": "John Doe",
                "email": "johndoe@example.com",
                "mobile": "+1234567890",
                "department": "Computer Science",
                "student_id": "60d21b4967d0d8992e610c86",
                "event_id": "60d21b4967d0d8992e610c87",
                "registration_id": "60d21b4967d0d8992e610c88",
                "timestamp": "2023-01-01T00:00:00"
            }
        } 