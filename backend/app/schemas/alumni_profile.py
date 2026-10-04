from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# Unknown keys are dropped (not stored). Privilege and verification fields such as
# is_admin, role, is_verified, verified_at, or password_hash are not in these
# models, so no profile request can set them.
_IGNORE_EXTRA = ConfigDict(extra="ignore")

# The only profile fields a user may write.
PROFILE_FIELDS: tuple[str, ...] = (
    "full_name",
    "student_id",
    "phone",
    "graduation_year",
    "batch",
    "course",
    "department",
    "sex",
    "civil_status",
    "birthday",
    "region_of_origin",
    "address",
    "bio",
    "current_job",
    "current_employer",
)


class AlumniProfileBase(BaseModel):
    user_id: str = Field(default='', max_length=64)
    full_name: str = Field(default='', max_length=255)
    email: str = Field(default='', max_length=255)
    student_id: str = Field(default='', max_length=64)
    phone: str = Field(default='', max_length=64)
    graduation_year: Optional[str] = Field(default=None, max_length=16)
    batch: Optional[str] = Field(default=None, max_length=64)
    course: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)
    sex: str = Field(default='', max_length=32)
    civil_status: str = Field(default='', max_length=32)
    birthday: str = Field(default='', max_length=32)
    region_of_origin: str = Field(default='', max_length=255)
    address: str = Field(default='', max_length=1000)
    bio: str = Field(default='', max_length=5000)
    profile_picture: str = Field(default='', max_length=500)
    current_job: str = Field(default='', max_length=255)
    current_employer: str = Field(default='', max_length=255)

    model_config = _IGNORE_EXTRA


class AlumniProfileCreate(AlumniProfileBase):
    pass


class AlumniProfileUpdate(BaseModel):
    user_id: Optional[str] = Field(default=None, max_length=64)
    full_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    student_id: Optional[str] = Field(default=None, max_length=64)
    phone: Optional[str] = Field(default=None, max_length=64)
    graduation_year: Optional[str] = Field(default=None, max_length=16)
    batch: Optional[str] = Field(default=None, max_length=64)
    course: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)
    sex: Optional[str] = Field(default=None, max_length=32)
    civil_status: Optional[str] = Field(default=None, max_length=32)
    birthday: Optional[str] = Field(default=None, max_length=32)
    region_of_origin: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=1000)
    bio: Optional[str] = Field(default=None, max_length=5000)
    profile_picture: Optional[str] = Field(default=None, max_length=500)
    current_job: Optional[str] = Field(default=None, max_length=255)
    current_employer: Optional[str] = Field(default=None, max_length=255)

    model_config = _IGNORE_EXTRA
