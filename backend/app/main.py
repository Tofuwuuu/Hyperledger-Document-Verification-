from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from app.api.api import api_router
from app.core.config import settings
from app.cors_middleware import add_cors_middleware

# Initialize FastAPI app
app = FastAPI(title="Alumni System API")

# Set up CORS with explicit frontend domain - standard approach
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://alumni-frontend-ybas.onrender.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Add custom CORS middleware as a backup
add_cors_middleware(app, frontend_url="https://alumni-frontend-ybas.onrender.com")

# Set up logging
logger = logging.getLogger(__name__)

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """Middleware to handle CSRF protection for non-GET methods"""
    # Skip CSRF check for safe methods (including OPTIONS)
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)
    
    # Log the request path for debugging
    request_path = request.url.path
    logger.info(f"CSRF middleware processing request: {request.method} {request_path}")
    
    # Immediately skip CSRF for any event-related paths or admin paths
    if "events" in request_path or "registrations" in request_path or request_path.startswith("/api/v1/admin/"):
        logger.info(f"BYPASSING CSRF check for path: {request_path}")
        return await call_next(request)
    
    # Skip CSRF for specified paths (like login, which can't have CSRF yet)
    skip_paths = [
        "/api/v1/auth/login", 
        "/api/v1/auth/register", 
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-reset-token",
        "/api/v1/auth/reset-password-confirm",
        "/api/v1/auth/verify-user/"
    ]
    
    # Check if the path should skip CSRF validation
    for path in skip_paths:
        if request_path.startswith(path):
            logger.info(f"CSRF check skipped for auth path: {request_path}")
            return await call_next(request)
    
    # Get CSRF token from header and cookie
    csrf_header = request.headers.get("X-CSRF-Token")
    csrf_cookie = request.cookies.get("csrf_token")
    
    # Log CSRF token values for debugging
    logger.info(f"CSRF Header: {'Present' if csrf_header else 'Not present'}")
    logger.info(f"CSRF Cookie: {'Present' if csrf_cookie else 'Not present'}")
    
    # If token is missing, return 403
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        logger.warning(f"CSRF validation FAILED for {request.method} {request_path}")
        return JSONResponse(
            status_code=403,
            content={"detail": "CSRF token missing or invalid"}
        )
    
    # Continue with the request
    logger.info(f"CSRF validation PASSED for {request.method} {request_path}")
    return await call_next(request) 

# Include API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to the Alumni System API. Go to /docs for the API documentation."} 