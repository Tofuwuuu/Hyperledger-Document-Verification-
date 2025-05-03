from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

from app.models.common import PyObjectId


class StudentBase(BaseModel):
    """Base model with common fields for Student."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    mobile: Optional[str] = None
    department: Optional[str] = None


class Student(StudentBase):
    """Model for a student with ID and timestamps."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {PyObjectId: str}
        schema_extra = {
            "example": {
                "_id": "60d21b4967d0d8992e610c85",
                "name": "John Doe",
                "email": "johndoe@example.com",
                "mobile": "+1234567890",
                "department": "Computer Science",
                "created_at": "2023-01-01T00:00:00",
                "updated_at": "2023-01-01T00:00:00"
            }
        }


class StudentCreate(StudentBase):
    """Model for creating a new student."""
    pass


class StudentUpdate(BaseModel):
    """Model for updating an existing student."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow) 