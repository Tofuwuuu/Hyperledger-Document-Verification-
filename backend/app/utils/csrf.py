from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.security import Depends
from log import logger

async def csrf_protect(
    request: Request,
    csrf_cookie_token: Optional[str] = Depends(csrf_cookie)
) -> None:
    """CSRF protection middleware for protected routes"""
    # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return

    # Check URL path to bypass CSRF for specific endpoints
    request_path = request.url.path
    logger.info(f"CSRF check for path: {request_path}")
    
    # Skip CSRF for event and registration endpoints
    if "events" in request_path or "registrations" in request_path:
        logger.info(f"CSRF protection BYPASSED for event/registration path: {request_path}")
        return
    
    # Skip CSRF for admin endpoints
    if request_path.startswith("/api/v1/admin/"):
        logger.info(f"CSRF protection BYPASSED for admin path: {request_path}")
        return

    # Get CSRF token from header
    csrf_header = request.headers.get(CSRF_HEADER_NAME)

    # Verify CSRF token
    if not csrf_cookie_token or not csrf_header or not verify_csrf_token(csrf_header, csrf_cookie_token):
        logger.warning(f"CSRF validation FAILED - Header: {bool(csrf_header)}, Cookie: {bool(csrf_cookie_token)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        ) 