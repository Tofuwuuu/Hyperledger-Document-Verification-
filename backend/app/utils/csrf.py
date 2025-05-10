from fastapi import Request, HTTPException, status, Depends
from fastapi.security import APIKeyCookie
import secrets
import time
import logging
from typing import Optional
from pydantic import BaseModel

# Setup logging
logger = logging.getLogger(__name__)

# CSRF token settings
CSRF_SECRET = "your-csrf-secret-key-change-this-in-production"  # Change this in production!
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
TOKEN_EXPIRY = 86400  # 24 hours in seconds

# Cookie security settings
csrf_cookie = APIKeyCookie(name=CSRF_COOKIE_NAME, auto_error=False)

class CSRFToken(BaseModel):
    value: str
    expires: int


def generate_csrf_token() -> CSRFToken:
    """Generate a new CSRF token with expiry time"""
    token_value = secrets.token_hex(32)
    expires = int(time.time()) + TOKEN_EXPIRY
    
    return CSRFToken(value=token_value, expires=expires)


def verify_csrf_token(token: str, cookie_token: str) -> bool:
    """Verify that the CSRF token matches the one in the cookie"""
    if not token or not cookie_token:
        return False
    
    # Simple equality check for now - could be enhanced with HMAC
    return token == cookie_token


async def csrf_protect(
    request: Request,
    csrf_cookie_token: Optional[str] = Depends(csrf_cookie)
) -> None:
    """CSRF protection middleware for protected routes"""
    # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return
    
    # Get CSRF token from header
    csrf_header = request.headers.get(CSRF_HEADER_NAME)
    
    # Verify CSRF token
    if not csrf_cookie_token or not csrf_header or not verify_csrf_token(csrf_header, csrf_cookie_token):
        logger.warning(f"CSRF validation failed - Header: {bool(csrf_header)}, Cookie: {bool(csrf_cookie_token)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        ) 