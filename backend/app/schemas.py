from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime

class UserLogin(BaseModel):
    """User login data"""
    email: str
    password: str

class MFASetupRequest(BaseModel):
    """Request to set up MFA for a user"""
    type: str = "email"  # Default to email-based MFA
    
class MFAEnableRequest(BaseModel):
    """Request to enable MFA with verification code"""
    verification_code: str
    
class MFALoginRequest(BaseModel):
    """Request to complete MFA login"""
    email: str
    verification_code: str
    
class MFAStatusResponse(BaseModel):
    """Response with MFA status for a user"""
    is_enabled: bool
    type: Optional[str] = None
    email: Optional[str] = None  # Partially masked email
    
class MFASetupResponse(BaseModel):
    """Response for MFA setup request"""
    setup_id: str
    message: str

class UserCreate(BaseModel):
    """User creation data"""
    email: EmailStr
    password: str
    full_name: str
    student_id: Optional[str] = None
    graduation_year: Optional[int] = None
    is_active: bool = True
    is_admin: bool = False
    
class UserOut(BaseModel):
    """User output data"""
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    is_admin: bool
    student_id: Optional[str] = None
    graduation_year: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_verified: Optional[bool] = None
    
class Token(BaseModel):
    """Token data"""
    access_token: str
    refresh_token: str
    token_type: str
    
class PasswordReset(BaseModel):
    """Password reset data"""
    email: EmailStr
    
class PasswordResetToken(BaseModel):
    """Password reset token data"""
    token: str
    
class PasswordResetConfirm(BaseModel):
    """Password reset confirmation data"""
    token: str
    password: str
    
class PasswordChange(BaseModel):
    """Password change data"""
    current_password: str
    new_password: str 