from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId

# Custom ObjectId field for proper serialization
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


class JobStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    FILLED = "filled"


class JobSkill(BaseModel):
    name: str
    level: Optional[str] = None  # e.g., "beginner", "intermediate", "expert"


class JobBase(BaseModel):
    title: str
    description: str
    location: str
    company_name: Optional[str] = None
    skills: Optional[List[str]] = []
    requirements: Optional[List[str]] = []
    responsibilities: Optional[List[str]] = []
    employment_type: Optional[str] = None  # e.g., "full-time", "part-time", "contract"
    salary_range: Optional[Dict[str, float]] = None  # {"min": 30000, "max": 50000}
    application_deadline: Optional[datetime] = None
    is_remote: Optional[bool] = False
    status: JobStatus = JobStatus.ACTIVE


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    responsibilities: Optional[List[str]] = None
    employment_type: Optional[str] = None
    salary_range: Optional[Dict[str, float]] = None
    application_deadline: Optional[datetime] = None
    is_remote: Optional[bool] = None
    status: Optional[JobStatus] = None


class JobInDB(JobBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    employer_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class JobResponse(JobBase):
    id: str
    employer_id: str
    employer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "id": "60d21b4967d0d8992e610c85",
                "title": "Software Engineer",
                "description": "We are looking for a talented software engineer.",
                "location": "Carmona, Cavite",
                "company_name": "Tech Solutions Inc.",
                "skills": ["Python", "JavaScript", "React"],
                "employment_type": "full-time",
                "status": "active",
                "employer_id": "60d21b4967d0d8992e610c80",
                "created_at": "2023-06-22T10:00:00",
                "updated_at": "2023-06-22T10:00:00"
            }
        }


class JobApplicantBase(BaseModel):
    job_id: str
    alumni_id: str
    cover_letter: Optional[str] = None
    status: str = "applied"  # applied, reviewing, interviewed, rejected, hired


class JobApplicantCreate(JobApplicantBase):
    pass


class JobApplicantUpdate(BaseModel):
    cover_letter: Optional[str] = None
    status: Optional[str] = None
    employer_notes: Optional[str] = None


class JobApplicantInDB(JobApplicantBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    employer_notes: Optional[str] = None
    
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class JobApplicantResponse(JobApplicantBase):
    id: str
    alumni_name: Optional[str] = None
    alumni_email: Optional[str] = None
    job_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime 