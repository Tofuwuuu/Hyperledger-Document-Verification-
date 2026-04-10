"""
Authentication utilities
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict
import jwt
from app.config import settings

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """
    Get current authenticated user from JWT token.
    This is a placeholder implementation - replace with actual JWT validation.
    """
    try:
        # Placeholder - in real implementation, decode JWT token
        # For now, return a mock user
        return {
            "username": "test_user",
            "_id": "user_id_123",
            "email": "test@example.com"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )