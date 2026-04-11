from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, EmailStr, Field


class SocialMediaItem(BaseModel):
    platform: str = Field(default='')
    url: str = Field(default='')


class AdvancedStudies(BaseModel):
    level: str = Field(default='')
    institution: str = Field(default='')
    field: str = Field(default='')
    motivation: str = Field(default='')


class AlumniProfileBase(BaseModel):
    user_id: str = Field(default='')
    full_name: str = Field(default='')
    email: str = Field(default='')
    student_id: str = Field(default='')
    phone: str = Field(default='')
    graduation_year: str = Field(default='')
    graduation_month: str = Field(default='')
    batch: str = Field(default='')
    course: str = Field(default='')
    department: str = Field(default='')
    sex: str = Field(default='')
    civil_status: str = Field(default='')
    birthday: str = Field(default='')
    region_of_origin: str = Field(default='')
    address: str = Field(default='')
    bio: str = Field(default='')
    profile_picture: str = Field(default='')
    social_media: List[SocialMediaItem] = Field(default_factory=list)
    honors_awards: str = Field(default='')
    degree_reasons: List[str] = Field(default_factory=list)
    degree_reasons_other: str = Field(default='')
    advanced_studies: AdvancedStudies = Field(default_factory=AdvancedStudies)
    csc_passer: bool | None = Field(default=None)
    csc_year: str = Field(default='')
    professional_exams: str = Field(default='')
    certifications: str = Field(default='')
    is_employed: str = Field(default='')
    unemployment_reason: List[str] = Field(default_factory=list)
    employment_status: str = Field(default='')
    occupation: str = Field(default='')
    company_name: str = Field(default='')
    company_address: str = Field(default='')
    company_sector: str = Field(default='')
    business_line: str = Field(default='')
    work_location: str = Field(default='')
    is_first_job: bool | None = Field(default=None)
    stay_reasons: List[str] = Field(default_factory=list)
    first_job_related: bool | None = Field(default=None)
    first_job_reasons: List[str] = Field(default_factory=list)
    first_job_tenure: str = Field(default='')
    first_job_acquisition: str = Field(default='')
    time_to_first_job: str = Field(default='')
    first_job_level: str = Field(default='')
    current_job_level: str = Field(default='')
    initial_salary: str = Field(default='')
    monthly_salary: str = Field(default='')
    curriculum_relevance_first: str = Field(default='')
    curriculum_relevance_current: str = Field(default='')
    skills: str = Field(default='')
    achievements: str = Field(default='')
    special_projects: str = Field(default='')
    professional_organizations: str = Field(default='')
    data_privacy_consent: bool = Field(default=False)
    date_employed: str = Field(default='')


class AlumniProfileCreate(AlumniProfileBase):
    pass


class AlumniProfileUpdate(AlumniProfileBase):
    pass
