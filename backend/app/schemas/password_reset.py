from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class PasswordReset(BaseModel):
    email: EmailStr = Field(..., description="User's email address")

class PasswordResetToken(BaseModel):
    token: str = Field(..., description="Password reset token")
    
class PasswordResetConfirm(BaseModel):
    token: str = Field(..., description="Password reset token")
    password: str = Field(..., min_length=6, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")
    
    @field_validator('password')
    def validate_password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v
    
    @field_validator('confirm_password')
    def passwords_match(cls, v, info):
        if hasattr(info, 'data') and 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v 