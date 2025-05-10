from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any

class MFASetupRequest(BaseModel):
    """Request to set up multi-factor authentication"""
    type: str = Field(..., description="Type of MFA (email, authenticator, etc.)")

class MFAEnableRequest(BaseModel):
    """Request to enable MFA after setup and verification"""
    verification_code: str = Field(..., description="Verification code to confirm MFA setup")

class MFALoginRequest(BaseModel):
    """Request to complete login with MFA verification"""
    email: EmailStr = Field(..., description="User's email address")
    verification_code: str = Field(..., description="Verification code sent to user")
    remember: bool = Field(False, description="Whether to remember the device")

class MFAStatusResponse(BaseModel):
    """Response with MFA status for the current user"""
    enabled: bool = Field(..., description="Whether MFA is enabled for the user")
    type: Optional[str] = Field(None, description="Type of MFA enabled")
    setup_complete: bool = Field(..., description="Whether MFA setup is complete")

class MFASetupResponse(BaseModel):
    """Response with data needed for MFA setup"""
    setup_id: str = Field(..., description="ID for the current setup session")
    type: str = Field(..., description="Type of MFA being set up")
    email_hint: Optional[str] = Field(None, description="Masked email for verification") 