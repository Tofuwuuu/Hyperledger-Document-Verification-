from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, Field, HttpUrl, validator
from datetime import datetime, date
import re
from enum import Enum
from app.utils.datetime_utils import get_aware_current_datetime

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class CivilStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    SEPARATED = "separated"
    WIDOWED = "widowed"

class SocialMedia(BaseModel):
    platform: str = Field(..., min_length=2, max_length=50, description="Social media platform name")
    url: HttpUrl = Field(..., description="Social media profile URL")
    
    @validator('platform')
    def validate_platform(cls, v):
        valid_platforms = [
            "facebook", "twitter", "instagram", "linkedin", 
            "github", "youtube", "tiktok", "discord", "other"
        ]
        if v.lower() not in valid_platforms:
            raise ValueError(f"Platform must be one of: {', '.join(valid_platforms)}")
        return v.lower()

class Education(BaseModel):
    degree: str = Field(..., min_length=2, max_length=100, description="Degree obtained")
    major: Optional[str] = Field(None, min_length=2, max_length=100, description="Major/specialization")
    graduation_year: int = Field(..., ge=1948, le=datetime.now().year, description="Year of graduation")
    graduation_month: Optional[str] = Field(None, description="Month of graduation (April, September, November)")
    honors_awards: Optional[str] = Field(None, max_length=500, description="Honors or awards received")
    
    @validator('graduation_year')
    def validate_graduation_year(cls, v):
        current_year = datetime.now().year
        if v < 1948:
            raise ValueError('Graduation year cannot be before 1948')
        if v > current_year:
            raise ValueError(f'Graduation year cannot be in the future (current year: {current_year})')
        return v
        
    @validator('graduation_month')
    def validate_graduation_month(cls, v):
        if v is None:
            return v
        valid_months = ["April", "September", "November"]
        if v not in valid_months:
            raise ValueError(f'Graduation month must be one of: {", ".join(valid_months)}')
        return v

class WorkExperience(BaseModel):
    company: str = Field(..., min_length=2, max_length=100, description="Company name")
    position: str = Field(..., min_length=2, max_length=100, description="Job position")
    start_date: datetime = Field(..., description="Start date of employment")
    end_date: Optional[datetime] = Field(None, description="End date of employment")
    is_current: bool = Field(False, description="Whether this is the current job")
    description: Optional[str] = Field(None, max_length=500, description="Job description")

class Achievement(BaseModel):
    title: str = Field(..., min_length=2, max_length=100, description="Achievement title")
    description: Optional[str] = Field(None, max_length=500, description="Achievement description")
    date: Optional[datetime] = Field(None, description="Date of achievement")
    issuer: Optional[str] = Field(None, min_length=2, max_length=100, description="Organization that issued the achievement")

class AlumniBase(BaseModel):
    # Basic information
    user_id: str = Field(..., description="User ID associated with this alumni profile")
    student_id: str = Field(..., min_length=5, max_length=20, description="Student ID number")
    full_name: str = Field(..., min_length=2, max_length=100, description="Alumni's full name")
    email: EmailStr = Field(..., description="Alumni's email address")
    phone: Optional[str] = Field(None, min_length=8, max_length=20, description="Contact phone number")
    address: Optional[str] = Field(None, max_length=200, description="Physical address")
    bio: Optional[str] = Field(None, max_length=1000, description="Short biography")
    profile_picture: Optional[str] = Field(None, description="Profile picture file path")
    
    # Academic information
    graduation_year: int = Field(..., ge=1948, le=datetime.now().year, description="Year of graduation")
    graduation_month: Optional[str] = Field(None, description="Month of graduation (April, September, November)")
    department: Optional[str] = Field(None, description="Academic department")
    course: Optional[str] = Field(None, description="Course or program")
    batch: Optional[str] = Field(None, description="Batch or class")
    
    # Personal information
    sex: Optional[Gender] = Field(None, description="Gender/Sex")
    civil_status: Optional[CivilStatus] = Field(None, description="Current civil status")
    birthday: Optional[date] = Field(None, description="Date of birth (YYYY-MM-DD)")
    region_of_origin: Optional[str] = Field(None, max_length=100, description="Region of origin")
    
    # Social media and achievements
    social_media: Optional[List[SocialMedia]] = Field(None, description="Social media profiles")
    honors_awards: Optional[str] = Field(None, max_length=500, description="Honors or awards received")
    
    # Academic reasons and continuing education
    degree_reasons: Optional[List[str]] = Field(None, description="Reasons for pursuing the degree")
    degree_reasons_other: Optional[str] = Field(None, max_length=200, description="Other reason for pursuing degree")
    advanced_studies: Optional[Dict[str, Any]] = Field(None, description="Advanced studies information")
    
    # Eligibility Fields
    csc_passer: Optional[bool] = Field(None, description="Civil Service Professional (CSC) Passer")
    csc_year: Optional[int] = Field(None, ge=1948, le=datetime.now().year, description="Year of passing CSC")
    professional_exams: Optional[str] = Field(None, max_length=500, description="Professional Examinations Passed")
    certifications: Optional[str] = Field(None, max_length=500, description="Certifications (NC Level, Microsoft, etc.)")
    
    # Employment Data Fields
    is_employed: Optional[str] = Field(None, description="Employment status (Yes, No, Never Employed)")
    unemployment_reason: Optional[str] = Field(None, max_length=500, description="Reason for unemployment")
    employment_status: Optional[str] = Field(None, description="Current employment status (Regular, Temporary, etc.)")
    occupation: Optional[str] = Field(None, max_length=200, description="Present occupation")
    business_type: Optional[str] = Field(None, description="Type of business if self-employed")
    company_name: Optional[str] = Field(None, max_length=200, description="Name of company/organization")
    company_address: Optional[str] = Field(None, max_length=500, description="Address of company/organization")
    company_sector: Optional[str] = Field(None, description="Nature of company (Government/Private)")
    business_line: Optional[str] = Field(None, description="Major line of business")
    work_location: Optional[str] = Field(None, description="Place of work (Within country/Abroad)")
    is_first_job: Optional[bool] = Field(None, description="Whether this is the first job")
    stay_reasons: Optional[List[str]] = Field(None, description="Reasons for staying in current job")
    first_job_related: Optional[bool] = Field(None, description="Whether first job was related to college course")
    first_job_reasons: Optional[List[str]] = Field(None, description="Reasons for accepting first job")
    first_job_tenure: Optional[str] = Field(None, description="How long stayed in first job")
    first_job_acquisition: Optional[str] = Field(None, description="How first job was found")
    time_to_first_job: Optional[str] = Field(None, description="Time taken to land first job")
    first_job_level: Optional[str] = Field(None, description="Job level in first job")
    current_job_level: Optional[str] = Field(None, description="Job level in current job")
    initial_salary: Optional[str] = Field(None, description="Initial gross monthly earning range")
    curriculum_relevance_first: Optional[str] = Field(None, description="Curriculum relevance to first job")
    curriculum_relevance_current: Optional[str] = Field(None, description="Curriculum relevance to current job")
    
    @validator('student_id')
    def validate_student_id(cls, v):
        if not re.match(r'^[A-Za-z0-9-]+$', v):
            raise ValueError('Student ID can only contain alphanumeric characters and hyphens')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        if not re.match(r'^\+?[0-9]{8,20}$', v):
            raise ValueError('Invalid phone number format')
        return v
    
    @validator('graduation_year')
    def validate_graduation_year(cls, v):
        current_year = datetime.now().year
        if v < 1948:
            raise ValueError('Graduation year cannot be before 1948')
        if v > current_year:
            raise ValueError(f'Graduation year cannot be in the future (current year: {current_year})')
        return v
        
    @validator('graduation_month')
    def validate_graduation_month(cls, v):
        if v is None:
            return v
        valid_months = ["April", "September", "November"]
        if v not in valid_months:
            raise ValueError(f'Graduation month must be one of: {", ".join(valid_months)}')
        return v
        
    @validator('department', 'course', 'batch')
    def convert_empty_to_none(cls, v):
        if v == "":
            return None
        return v

class AlumniCreate(AlumniBase):
    """Schema for creating a new alumni profile"""
    education: Optional[List[Education]] = Field(None, description="Educational background")
    work_experience: Optional[List[WorkExperience]] = Field(None, description="Work experience")
    achievements: Optional[List[Achievement]] = Field(None, description="Achievements and awards")

class AlumniUpdate(BaseModel):
    """Schema for updating an existing alumni profile"""
    # All fields are optional for updates
    student_id: Optional[str] = Field(None, min_length=5, max_length=20, description="Student ID number")
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="Alumni's full name")
    email: Optional[EmailStr] = Field(None, description="Alumni's email address")
    phone: Optional[str] = Field(None, min_length=8, max_length=20, description="Contact phone number")
    address: Optional[str] = Field(None, max_length=200, description="Physical address")
    bio: Optional[str] = Field(None, max_length=1000, description="Short biography")
    profile_picture: Optional[str] = Field(None, description="Profile picture file path")
    graduation_year: Optional[int] = Field(None, ge=1948, le=datetime.now().year, description="Year of graduation")
    graduation_month: Optional[str] = Field(None, description="Month of graduation (April, September, November)")
    department: Optional[str] = Field(None, min_length=2, max_length=100, description="Academic department")
    course: Optional[str] = Field(None, min_length=2, max_length=100, description="Course or program")
    batch: Optional[str] = Field(None, min_length=2, max_length=20, description="Batch or class")
    sex: Optional[Gender] = Field(None, description="Gender/Sex")
    civil_status: Optional[CivilStatus] = Field(None, description="Current civil status")
    birthday: Optional[date] = Field(None, description="Date of birth (YYYY-MM-DD)")
    region_of_origin: Optional[str] = Field(None, max_length=100, description="Region of origin")
    social_media: Optional[List[SocialMedia]] = Field(None, description="Social media profiles")
    education: Optional[List[Education]] = Field(None, description="Educational background")
    work_experience: Optional[List[WorkExperience]] = Field(None, description="Work experience")
    achievements: Optional[List[Achievement]] = Field(None, description="Achievements and awards")
    honors_awards: Optional[str] = Field(None, max_length=500, description="Honors or awards received")
    degree_reasons: Optional[List[str]] = Field(None, description="Reasons for pursuing the degree")
    degree_reasons_other: Optional[str] = Field(None, max_length=200, description="Other reason for pursuing degree")
    advanced_studies: Optional[Dict[str, Any]] = Field(None, description="Advanced studies information")
    
    # Eligibility Fields
    csc_passer: Optional[bool] = Field(None, description="Civil Service Professional (CSC) Passer")
    csc_year: Optional[int] = Field(None, ge=1948, le=datetime.now().year, description="Year of passing CSC")
    professional_exams: Optional[str] = Field(None, max_length=500, description="Professional Examinations Passed")
    certifications: Optional[str] = Field(None, max_length=500, description="Certifications (NC Level, Microsoft, etc.)")
    
    # Employment Data Fields
    is_employed: Optional[str] = Field(None, description="Employment status (Yes, No, Never Employed)")
    unemployment_reason: Optional[str] = Field(None, max_length=500, description="Reason for unemployment")
    employment_status: Optional[str] = Field(None, description="Current employment status (Regular, Temporary, etc.)")
    occupation: Optional[str] = Field(None, max_length=200, description="Present occupation")
    business_type: Optional[str] = Field(None, description="Type of business if self-employed")
    company_name: Optional[str] = Field(None, max_length=200, description="Name of company/organization")
    company_address: Optional[str] = Field(None, max_length=500, description="Address of company/organization")
    company_sector: Optional[str] = Field(None, description="Nature of company (Government/Private)")
    business_line: Optional[str] = Field(None, description="Major line of business")
    work_location: Optional[str] = Field(None, description="Place of work (Within country/Abroad)")
    is_first_job: Optional[bool] = Field(None, description="Whether this is the first job")
    stay_reasons: Optional[List[str]] = Field(None, description="Reasons for staying in current job")
    first_job_related: Optional[bool] = Field(None, description="Whether first job was related to college course")
    first_job_reasons: Optional[List[str]] = Field(None, description="Reasons for accepting first job")
    first_job_tenure: Optional[str] = Field(None, description="How long stayed in first job")
    first_job_acquisition: Optional[str] = Field(None, description="How first job was found")
    time_to_first_job: Optional[str] = Field(None, description="Time taken to land first job")
    first_job_level: Optional[str] = Field(None, description="Job level in first job")
    current_job_level: Optional[str] = Field(None, description="Job level in current job")
    initial_salary: Optional[str] = Field(None, description="Initial gross monthly earning range")
    curriculum_relevance_first: Optional[str] = Field(None, description="Curriculum relevance to first job")
    curriculum_relevance_current: Optional[str] = Field(None, description="Curriculum relevance to current job")
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        if not re.match(r'^\+?[0-9]{8,20}$', v):
            raise ValueError('Invalid phone number format')
        return v

class AlumniInDB(AlumniBase):
    """Schema for alumni profile as stored in the database"""
    id: str = Field(..., alias="_id", description="Alumni profile ID")
    education: Optional[List[Education]] = Field(None, description="Educational background")
    work_experience: Optional[List[WorkExperience]] = Field(None, description="Work experience")
    achievements: Optional[List[Achievement]] = Field(None, description="Achievements and awards")
    created_at: datetime = Field(..., description="Profile creation timestamp")
    updated_at: datetime = Field(..., description="Profile last update timestamp")
    profile_completed: bool = Field(False, description="Whether the profile has all required fields completed")
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "6805fb0b83c5c32acf87a24c",
                "user_id": "6804c06543846509ed9ba2ed",
                "student_id": "210100713",
                "full_name": "rod",
                "email": "rodericksalise812@gmail.com",
                "phone": "09728361231",
                "address": "Ederadan St. 182",
                "bio": "HELLO",
                "profile_picture": "",
                "graduation_year": 2001,
                "department": "BSCS",
                "course": "Bachelor of Science in Computer Science",
                "batch": "wew",
                "social_media": [],
                "education": None,
                "work_experience": None,
                "achievements": [],
                "created_at": "2025-04-21T08:00:11.850+00:00",
                "updated_at": "2025-05-14T10:25:39.949+00:00",
                "birthday": "2002-08-21T00:00:00.000+00:00",
                "civil_status": "single",
                "region_of_origin": "Region IV-A (CALABARZON)",
                "sex": "male",
                "advanced_studies": {},
                "degree_reasons": ["Affordable tuition fee"],
                "graduation_month": "April",
                "honors_awards": "N\\A",
                "csc_passer": False,
                "certifications": "yes",
                "degree_reasons_other": "",
                "professional_exams": "yes",
                "company_address": "na",
                "company_name": "na",
                "employment_status": "REGULAR",
                "is_employed": "Yes",
                "occupation": "na",
                "business_line": "Education",
                "company_sector": "Government Institution",
                "current_job_level": "Rank and File, Clerical",
                "curriculum_relevance_current": "2",
                "curriculum_relevance_first": "3",
                "first_job_acquisition": "Response to an advertisement",
                "first_job_level": "Self-Employed",
                "first_job_reasons": ["Salaries and benefits"],
                "first_job_related": True,
                "first_job_tenure": "Less than a month",
                "initial_salary": "1222",
                "is_first_job": True,
                "stay_reasons": ["Salaries and benefits"],
                "time_to_first_job": "na",
                "unemployment_reason": "Other: ",
                "work_location": "Within the country",
                "profile_completed": True
            }
        }

class AlumniOut(AlumniInDB):
    """Schema for alumni profile in API responses"""
    verified_documents: Optional[List[str]] = Field(None, description="List of verified document IDs")
    
    class Config:
        populate_by_name = True

class AlumniSearchParams(BaseModel):
    """Parameters for searching alumni profiles"""
    name: Optional[str] = Field(None, description="Search by name")
    graduation_year: Optional[int] = Field(None, description="Filter by graduation year")
    department: Optional[str] = Field(None, description="Filter by department")
    course: Optional[str] = Field(None, description="Filter by course")
    batch: Optional[str] = Field(None, description="Filter by batch") 
    limit: Optional[int] = Field(10, ge=1, le=100, description="Maximum number of results")
    offset: Optional[int] = Field(0, ge=0, description="Pagination offset")

class AlumniSearchResult(BaseModel):
    """Results from an alumni search query"""
    results: List[AlumniOut] = Field(..., description="List of alumni profiles matching search criteria")
    total: int = Field(..., description="Total number of matching profiles")
    limit: int = Field(..., description="Maximum number of results per page")
    offset: int = Field(..., description="Current pagination offset")

class ApiResponse(BaseModel):
    """Standard API response format"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Message describing the result")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data payload") 