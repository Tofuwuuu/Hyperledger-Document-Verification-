from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, Field, HttpUrl, validator
from datetime import datetime
import re
from enum import Enum

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
    degree_reasons: Optional[List[str]] = Field(None, description="Reasons for pursuing the degree")
    degree_reasons_other: Optional[str] = Field(None, max_length=200, description="Other reason for pursuing degree")
    advanced_studies: Optional[Dict[str, Any]] = Field(None, description="Advanced studies information")
    
    @validator('graduation_year')
    def validate_graduation_year(cls, v):
        current_year = datetime.now().year
        if v < 1948:  # Assuming the institution was founded in 1948
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
    
    @validator('end_date')
    def validate_end_date(cls, v, values):
        if v is None:
            return v
        
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date cannot be before start date')
        
        if v > datetime.now():
            raise ValueError('End date cannot be in the future')
            
        return v
    
    @validator('is_current')
    def validate_is_current(cls, v, values):
        if v and 'end_date' in values and values['end_date'] is not None:
            raise ValueError('Cannot be current job if end date is provided')
        return v

class Achievement(BaseModel):
    title: str = Field(..., min_length=2, max_length=100, description="Achievement title")
    description: Optional[str] = Field(None, max_length=500, description="Achievement description")
    date: Optional[datetime] = Field(None, description="Date of achievement")
    issuer: Optional[str] = Field(None, min_length=2, max_length=100, description="Organization that issued the achievement")
    
    @validator('date')
    def validate_date(cls, v):
        if v is None:
            return v
        if v > datetime.now():
            raise ValueError('Achievement date cannot be in the future')
        return v

class AlumniBase(BaseModel):
    user_id: str = Field(..., description="User ID associated with this alumni profile")
    student_id: str = Field(..., min_length=5, max_length=20, description="Student ID number")
    full_name: str = Field(..., min_length=2, max_length=100, description="Alumni's full name")
    email: EmailStr = Field(..., description="Alumni's email address")
    phone: Optional[str] = Field(None, min_length=8, max_length=20, description="Contact phone number")
    address: Optional[str] = Field(None, max_length=200, description="Physical address")
    bio: Optional[str] = Field(None, max_length=1000, description="Short biography")
    profile_picture: Optional[str] = Field(None, description="Profile picture file path")
    graduation_year: int = Field(..., ge=1948, le=datetime.now().year, description="Year of graduation")
    graduation_month: Optional[str] = Field(None, description="Month of graduation (April, September, November)")
    department: str = Field(..., min_length=2, max_length=100, description="Academic department")
    course: str = Field(..., min_length=2, max_length=100, description="Course or program")
    batch: str = Field(..., min_length=2, max_length=20, description="Batch or class")
    social_media: Optional[List[SocialMedia]] = Field(None, description="Social media profiles")
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
    unemployment_reason: Optional[Union[str, List[str]]] = Field(None, description="Reason for unemployment")
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
    
    sex: Optional[Gender] = Field(None, description="Gender/Sex")
    civil_status: Optional[CivilStatus] = Field(None, description="Current civil status")
    birthday: Optional[datetime] = Field(None, description="Date of birth")
    region_of_origin: Optional[str] = Field(None, max_length=100, description="Region of origin")
    
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
        if v < 1948:  # Assuming the institution was founded in 1948
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

    @validator('birthday')
    def validate_birthday(cls, v):
        if v is None:
            return v
        
        current_date = datetime.now()
        # Check if birthday is in the future
        if v > current_date:
            raise ValueError('Birthday cannot be in the future')
            
        # Check if the person is at least 16 years old (reasonable minimum age for alumni)
        min_birth_year = current_date.year - 16
        min_birth_date = datetime(min_birth_year, current_date.month, current_date.day)
        if v > min_birth_date:
            raise ValueError('Alumni must be at least 16 years old')
            
        # Check if birthday is reasonable (not more than 100 years ago)
        max_age = 100
        max_birth_year = current_date.year - max_age
        max_birth_date = datetime(max_birth_year, current_date.month, current_date.day)
        if v < max_birth_date:
            raise ValueError(f'Birthday indicates age greater than {max_age} years')
            
        return v

    @validator('csc_year')
    def validate_csc_year(cls, v, values):
        if v is None:
            return v
        
        current_year = datetime.now().year
        if v < 1948:  # Assuming CSC didn't exist before institution's founding
            raise ValueError('CSC exam year cannot be before 1948')
        if v > current_year:
            raise ValueError(f'CSC exam year cannot be in the future (current year: {current_year})')
        
        # Check if user is CSC passer
        if 'csc_passer' in values and values['csc_passer'] is False:
            raise ValueError('Cannot specify CSC year if not a CSC passer')
            
        return v

class AlumniCreate(AlumniBase):
    education: Optional[List[Education]] = Field(None, description="Educational background")
    work_experience: Optional[List[WorkExperience]] = Field(None, description="Work experience")
    achievements: Optional[List[Achievement]] = Field(None, description="Achievements and awards")

class AlumniUpdate(BaseModel):
    phone: Optional[str] = Field(None, min_length=8, max_length=20, description="Contact phone number")
    address: Optional[str] = Field(None, max_length=200, description="Physical address")
    bio: Optional[str] = Field(None, max_length=1000, description="Short biography")
    profile_picture: Optional[str] = Field(None, description="Profile picture file path")
    department: Optional[str] = Field(None, min_length=2, max_length=100, description="Academic department")
    course: Optional[str] = Field(None, min_length=2, max_length=100, description="Course or program")
    batch: Optional[str] = Field(None, min_length=2, max_length=20, description="Batch or class")
    graduation_month: Optional[str] = Field(None, description="Month of graduation (April, September, November)")
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
    unemployment_reason: Optional[Union[str, List[str]]] = Field(None, description="Reason for unemployment")
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
    
    sex: Optional[Gender] = Field(None, description="Gender/Sex")
    civil_status: Optional[CivilStatus] = Field(None, description="Current civil status")
    birthday: Optional[datetime] = Field(None, description="Date of birth")
    region_of_origin: Optional[str] = Field(None, max_length=100, description="Region of origin")
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        if not re.match(r'^\+?[0-9]{8,20}$', v):
            raise ValueError('Invalid phone number format')
        return v
        
    @validator('graduation_month')
    def validate_graduation_month(cls, v):
        if v is None:
            return v
        valid_months = ["April", "September", "November"]
        if v not in valid_months:
            raise ValueError(f'Graduation month must be one of: {", ".join(valid_months)}')
        return v

    @validator('birthday')
    def validate_birthday(cls, v):
        if v is None:
            return v
        
        current_date = datetime.now()
        # Check if birthday is in the future
        if v > current_date:
            raise ValueError('Birthday cannot be in the future')
            
        # Check if the person is at least 16 years old (reasonable minimum age for alumni)
        min_birth_year = current_date.year - 16
        min_birth_date = datetime(min_birth_year, current_date.month, current_date.day)
        if v > min_birth_date:
            raise ValueError('Alumni must be at least 16 years old')
            
        # Check if birthday is reasonable (not more than 100 years ago)
        max_age = 100
        max_birth_year = current_date.year - max_age
        max_birth_date = datetime(max_birth_year, current_date.month, current_date.day)
        if v < max_birth_date:
            raise ValueError(f'Birthday indicates age greater than {max_age} years')
            
        return v

    @validator('csc_year')
    def validate_csc_year(cls, v, values):
        if v is None:
            return v
        
        current_year = datetime.now().year
        if v < 1948:  # Assuming CSC didn't exist before institution's founding
            raise ValueError('CSC exam year cannot be before 1948')
        if v > current_year:
            raise ValueError(f'CSC exam year cannot be in the future (current year: {current_year})')
        
        # Check if user is CSC passer
        if 'csc_passer' in values and values['csc_passer'] is False:
            raise ValueError('Cannot specify CSC year if not a CSC passer')
            
        return v

class AlumniInDB(AlumniBase):
    id: str = Field(..., alias="_id", description="Alumni profile ID")
    education: Optional[List[Education]] = Field(None, description="Educational background")
    work_experience: Optional[List[WorkExperience]] = Field(None, description="Work experience")
    achievements: Optional[List[Achievement]] = Field(None, description="Achievements and awards")
    created_at: datetime = Field(..., description="Profile creation timestamp")
    updated_at: datetime = Field(..., description="Profile last update timestamp")
    
    class Config:
        allow_population_by_field_name = True

class AlumniOut(AlumniInDB):
    verified_documents: Optional[List[str]] = Field(None, description="List of verified document IDs")
    
    class Config:
        allow_population_by_field_name = True

class AlumniSearchParams(BaseModel):
    name: Optional[str] = Field(None, description="Search by name")
    graduation_year: Optional[int] = Field(None, description="Filter by graduation year")
    department: Optional[str] = Field(None, description="Filter by department")
    course: Optional[str] = Field(None, description="Filter by course")
    batch: Optional[str] = Field(None, description="Filter by batch")
    limit: Optional[int] = Field(10, ge=1, le=100, description="Maximum number of results")
    offset: Optional[int] = Field(0, ge=0, description="Pagination offset")

class AlumniSearchResult(BaseModel):
    results: List[AlumniOut] = Field(..., description="List of alumni profiles matching search criteria")
    total: int = Field(..., description="Total number of matching profiles")
    limit: int = Field(..., description="Maximum number of results per page")
    offset: int = Field(..., description="Current pagination offset")
    
class ProfilePictureUpload(BaseModel):
    alumni_id: str = Field(..., description="Alumni ID") 