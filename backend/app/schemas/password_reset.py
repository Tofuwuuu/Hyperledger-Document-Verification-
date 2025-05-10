from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class PasswordReset(BaseModel):
    email: EmailStr = Field(..., description="User's email address")

class PasswordResetToken(BaseModel):
    token: str = Field(..., description="Password reset token")
    
class PasswordResetConfirm(BaseModel):
    token: str = Field(..., description="Password reset token")
    password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")
    
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