from __future__ import annotations

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None = None
    student_id: str | None = None
    graduation_year: str | None = None
    is_admin: bool = False
    is_verified: bool = False
    role: str | None = None
    profile_id: str | None = None
