from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
import re

class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    is_active: bool = Field(True, description="Whether the user account is active")
    is_admin: bool = Field(False, description="Whether the user has admin privileges")
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Full name cannot be empty')
        if len(v) < 2:
            raise ValueError('Full name must be at least 2 characters')
        return v.strip()
    
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="User's password")
    confirm_password: str = Field(..., description="Password confirmation")
    student_id: Optional[str] = Field(None, min_length=5, max_length=20, description="Student ID number")
    graduation_year: Optional[int] = Field(None, ge=1948, le=datetime.now().year, description="Year of graduation")
    role_id: Optional[str] = Field(None, description="Role ID for the user")
    
    @field_validator('password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v
    
    @field_validator('confirm_password')
    def passwords_match(cls, v, info):
        if hasattr(info, 'data') and 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v
    
    @field_validator('student_id')
    def validate_student_id(cls, v):
        if v is None:
            return v
        if not re.match(r'^[A-Za-z0-9-]+$', v):
            raise ValueError('Student ID can only contain alphanumeric characters and hyphens')
        return v
    
    @field_validator('graduation_year')
    def validate_graduation_year(cls, v):
        if v is None:
            return v
        current_year = datetime.now().year
        if v < 1948:  # Assuming the institution was founded in 1948
            raise ValueError('Graduation year cannot be before 1948')
        if v > current_year:
            raise ValueError(f'Graduation year cannot be in the future (current year: {current_year})')
        return v
    
class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")
    
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, description="User's email address")
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="User's full name")
    password: Optional[str] = Field(None, min_length=8, description="User's password")
    confirm_password: Optional[str] = Field(None, description="Password confirmation")
    is_active: Optional[bool] = Field(None, description="Whether the user account is active")
    is_admin: Optional[bool] = Field(None, description="Whether the user has admin privileges")
    student_id: Optional[str] = Field(None, min_length=5, max_length=20, description="Student ID number")
    graduation_year: Optional[int] = Field(None, ge=1948, le=datetime.now().year, description="Year of graduation")
    role_id: Optional[str] = Field(None, description="Role ID for the user")
    
    @field_validator('full_name')
    def validate_full_name(cls, v):
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError('Full name cannot be empty')
        if len(v) < 2:
            raise ValueError('Full name must be at least 2 characters')
        return v.strip()
    
    @field_validator('password')
    def validate_password_strength(cls, v):
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v
    
    @field_validator('confirm_password')
    def passwords_match(cls, v, info):
        if v is None:
            return v
        if hasattr(info, 'data') and 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v
    
    @field_validator('student_id')
    def validate_student_id(cls, v):
        if v is None:
            return v
        if not re.match(r'^[A-Za-z0-9-]+$', v):
            raise ValueError('Student ID can only contain alphanumeric characters and hyphens')
        return v
    
class PasswordReset(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    
class PasswordChange(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")
    
    @field_validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v
    
    @field_validator('confirm_password')
    def passwords_match(cls, v, info):
        if hasattr(info, 'data') and 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v
    
class UserInDB(UserBase):
    id: str = Field(..., alias="_id", description="User ID")
    hashed_password: str = Field(..., description="Hashed password")
    student_id: Optional[str] = Field(None, description="Student ID number")
    graduation_year: Optional[int] = Field(None, description="Year of graduation")
    role_id: Optional[str] = Field(None, description="Role ID for the user")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Account last update timestamp")
    
    model_config = {
        "populate_by_name": True
    }
        
class UserOut(UserBase):
    id: str = Field(..., alias="_id", description="User ID")
    student_id: Optional[str] = Field(None, description="Student ID number")
    graduation_year: Optional[int] = Field(None, description="Year of graduation")
    role_id: Optional[str] = Field(None, description="Role ID for the user")
    role: Optional[str] = Field(None, description="Role name")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Account last update timestamp")
    
    model_config = {
        "populate_by_name": True
    }
        
class TokenData(BaseModel):
    sub: str = Field(..., description="Subject (user ID)")
    exp: datetime = Field(..., description="Expiration time")
    
class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[datetime] = None
    
class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field("bearer", description="Token type")

class PaginationMeta(BaseModel):
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total number of items")
    totalPages: int = Field(..., description="Total number of pages")

class UserPaginatedResponse(BaseModel):
    items: List[UserOut] = Field(..., description="List of users")
    meta: PaginationMeta = Field(..., description="Pagination metadata") 