from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from datetime import datetime
from enum import Enum

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class CivilStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    SEPARATED = "separated"
    WIDOWED = "widowed"

class Education(BaseModel):
    degree: str
    major: Optional[str] = None
    graduation_year: int
    honors: Optional[List[str]] = None

class WorkExperience(BaseModel):
    company: str
    position: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_current: bool = False
    description: Optional[str] = None

class Achievement(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[datetime] = None
    issuer: Optional[str] = None

class SocialMedia(BaseModel):
    platform: str
    url: HttpUrl

class AlumniBase(BaseModel):
    user_id: str
    student_id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    graduation_year: int
    department: str
    course: str
    batch: str
    social_media: Optional[List[SocialMedia]] = None
    sex: Optional[Gender] = None
    civil_status: Optional[CivilStatus] = None
    birthday: Optional[datetime] = None
    region_of_origin: Optional[str] = None
    
class AlumniCreate(AlumniBase):
    education: Optional[List[Education]] = None
    work_experience: Optional[List[WorkExperience]] = None
    achievements: Optional[List[Achievement]] = None
    
class AlumniUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    department: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    social_media: Optional[List[SocialMedia]] = None
    education: Optional[List[Education]] = None
    work_experience: Optional[List[WorkExperience]] = None
    achievements: Optional[List[Achievement]] = None
    sex: Optional[Gender] = None
    civil_status: Optional[CivilStatus] = None
    birthday: Optional[datetime] = None
    region_of_origin: Optional[str] = None
    
class AlumniInDB(AlumniBase):
    id: str = Field(..., alias="_id")
    education: Optional[List[Education]] = None
    work_experience: Optional[List[WorkExperience]] = None
    achievements: Optional[List[Achievement]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True
        
class AlumniOut(AlumniInDB):
    verified_documents: Optional[List[str]] = None 