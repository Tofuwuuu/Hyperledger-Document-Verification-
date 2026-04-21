from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AlumniProfileBase(BaseModel):
    user_id: str = Field(default='')
    full_name: str = Field(default='')
    email: str = Field(default='')
    student_id: str = Field(default='')
    phone: str = Field(default='')
    graduation_year: str = Field(default='')
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
    current_job: str = Field(default='')
    current_employer: str = Field(default='')

    class Config:
        extra = "allow"


class AlumniProfileCreate(AlumniProfileBase):
    pass


class AlumniProfileUpdate(BaseModel):
    user_id: Optional[str] = Field(default=None)
    full_name: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    student_id: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    graduation_year: Optional[str] = Field(default=None)
    batch: Optional[str] = Field(default=None)
    course: Optional[str] = Field(default=None)
    department: Optional[str] = Field(default=None)
    sex: Optional[str] = Field(default=None)
    civil_status: Optional[str] = Field(default=None)
    birthday: Optional[str] = Field(default=None)
    region_of_origin: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None)
    profile_picture: Optional[str] = Field(default=None)
    current_job: Optional[str] = Field(default=None)
    current_employer: Optional[str] = Field(default=None)

    class Config:
        extra = "allow"
