from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
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
    ARCHIVED = "archived"


class ApplicationStatus(str, Enum):
    APPLIED = "applied"
    REVIEWING = "reviewing"
    SHORTLISTED = "shortlisted"
    INTERVIEWED = "interviewed"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"


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
    """Schema for creating a new job posting"""
    pass


class JobUpdate(BaseModel):
    """Schema for updating a job posting - all fields optional"""
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
    """Schema for job stored in database"""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    employer_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    applicant_count: Optional[int] = 0
    
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class JobResponse(JobBase):
    """Schema for job response to client"""
    id: str
    employer_id: str
    employer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    applicant_count: Optional[int] = 0
    
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
                "updated_at": "2023-06-22T10:00:00",
                "applicant_count": 3
            }
        }


class ApplicationBase(BaseModel):
    """Base schema for job applications"""
    job_id: str
    applicant_id: str
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.APPLIED


class ApplicationCreate(ApplicationBase):
    """Schema for creating a new application"""
    pass


class ApplicationUpdate(BaseModel):
    """Schema for updating an application - all fields optional"""
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    employer_notes: Optional[str] = None


class ApplicationInDB(ApplicationBase):
    """Schema for application stored in database"""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    employer_notes: Optional[str] = None
    
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class ApplicationResponse(ApplicationBase):
    """Schema for application response to client"""
    id: str
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "id": "60d21b4967d0d8992e610c85",
                "job_id": "60d21b4967d0d8992e610c80",
                "applicant_id": "60d21b4967d0d8992e610c81",
                "applicant_name": "John Doe",
                "applicant_email": "john.doe@example.com",
                "job_title": "Software Engineer",
                "company_name": "Tech Solutions Inc.",
                "cover_letter": "I am excited to apply...",
                "resume_url": "/uploads/resumes/johndoe_resume.pdf",
                "status": "applied",
                "created_at": "2023-06-22T10:00:00",
                "updated_at": "2023-06-22T10:00:00"
            }
        }


class CandidateSearchResult(BaseModel):
    """Schema for candidate search results"""
    id: str
    name: str
    email: Optional[EmailStr] = None
    program: Optional[str] = None
    graduation_year: Optional[Union[int, str]] = None
    skills: List[str] = []
    match_percentage: float 