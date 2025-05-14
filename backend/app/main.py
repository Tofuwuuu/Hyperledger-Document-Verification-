from fastapi import Request, FastAPI, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
import logging
import os
import time
from datetime import datetime, timezone
from app.api.api import api_router
from app.core.config import settings
from app.config.database import connect_to_mongo, close_mongo_connection
from app.utils.auth import get_current_user_from_token
from app.core.logging_config import setup_logging

# Set up logging
setup_logging()

# Initialize FastAPI app
app = FastAPI(
    title="CVSU Alumni API",
    description="API for the CVSU Alumni System",
    version="1.0.0",
    docs_url=None,  # Disable default docs
    redoc_url=None,  # Disable default redoc
)

# Configure logger for application
logger = logging.getLogger("app.main")

# Configure CORS
# Updated origins for development and production
if os.environ.get("ENV") == "production":
    # Production environment - use specific origins with credentials
    origins = [
        "https://alumni-frontend-zzr2.onrender.com",  # Production frontend
        "https://cvsu-alumni.netlify.app",           # Alternative deployment
    ]
else:
    # Development environment - allow all local development origins
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000",  # Backend server
    ]
    logger.info(f"Development mode CORS origins: {origins}")

# Configure the CORS middleware with correct settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Authorization"],
    max_age=86400,  # Cache preflight requests for 1 day
)

# Disable CSRF middleware for now to debug CORS
# @app.middleware("http")
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

# Direct OPTIONS handler for login that works for any origin
@app.options("/api/v1/auth/login")
async def options_auth_login(request: Request):
    logger.info(f"OPTIONS request received for auth/login from origin: {request.headers.get('origin', 'Unknown')}")
    
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Check if the origin is in our allowed origins
    if origin != "*" and origin not in origins:
        logger.info(f"Origin {origin} not in allowed origins, defaulting to first allowed origin")
        origin = origins[0] if origins else "*"
    
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    logger.info(f"Returning headers for OPTIONS request: {headers}")
    return JSONResponse(content={}, headers=headers)

# Direct OPTIONS handler for alumni endpoints - this is critical for profile creation
@app.options("/api/v1/alumni/")
async def options_alumni_create(request: Request):
    logger.info(f"OPTIONS request received for alumni/ from origin: {request.headers.get('origin', 'Unknown')}")
    
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Check if the origin is in our allowed origins
    if origin != "*" and origin not in origins:
        logger.info(f"Origin {origin} not in allowed origins, defaulting to first allowed origin")
        origin = origins[0] if origins else "*"
    
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    logger.info(f"Returning headers for alumni OPTIONS request: {headers}")
    return JSONResponse(content={}, headers=headers)

# Direct OPTIONS handler for references endpoints
@app.options("/api/v1/references/{path:path}")
async def options_references(request: Request, path: str):
    logger.info(f"OPTIONS request received for references/{path} from origin: {request.headers.get('origin', 'Unknown')}")
    
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Check if the origin is in our allowed origins
    if origin != "*" and origin not in origins:
        logger.info(f"Origin {origin} not in allowed origins, defaulting to first allowed origin")
        origin = origins[0] if origins else "*"
    
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    logger.info(f"Returning headers for references OPTIONS request: {headers}")
    return JSONResponse(content={}, headers=headers)

# Fallback OPTIONS handler for all other routes
@app.options("/{full_path:path}")
async def options_all(request: Request, full_path: str):
    logger.info(f"OPTIONS request received for {full_path} from origin: {request.headers.get('origin', 'Unknown')}")
    
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    # Check if the origin is in our allowed origins
    if origin != "*" and origin not in origins:
        logger.info(f"Origin {origin} not in allowed origins, defaulting to first allowed origin")
        origin = origins[0] if origins else "*"
    
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    logger.info(f"Returning headers for OPTIONS request: {headers}")
    return JSONResponse(content={}, headers=headers)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Add a CORS debug middleware
@app.middleware("http")
async def cors_debug_middleware(request: Request, call_next):
    # Get the path for debugging
    path = request.url.path
    method = request.method
    origin = request.headers.get("origin", "No origin")
    
    logger.info(f"Request: {method} {path} from {origin}")
    
    # Process the request
    response = await call_next(request)
    
    # For paths with CORS issues, ensure headers are set
    critical_paths = ["/api/v1/alumni", "/api/v1/references"]
    for critical_path in critical_paths:
        if path.startswith(critical_path):
            logger.info(f"Adding CORS headers for critical path: {path}")
            response.headers["Access-Control-Allow-Origin"] = origin if origin != "No origin" else "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Origin"
            
    # Log the response status
    logger.info(f"Response status: {response.status_code}")
    
    return response

# Helper function to ensure datetimes have timezone info
def ensure_timezone(dt):
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# Middleware to handle datetime timezone issues
@app.middleware("http")
async def timezone_middleware(request: Request, call_next):
    response = await call_next(request)
    return response

# Startup and shutdown events
@app.on_event("startup")
async def startup_db_client():
    logger.info("Connecting to MongoDB...")
    try:
        await connect_to_mongo()
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # We'll continue to let the application try to start
        # Individual routes will handle connection errors

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()
    logger.info("Disconnected from MongoDB")

# Mount uploads directory for static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Request logging middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    
    # Skip logging for static files
    if request.url.path.startswith("/uploads"):
        response = await call_next(request)
        return response
    
    # Log request details
    logger.info(f"Request: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(f"Response: {response.status_code} ({process_time:.3f}s)")
        return response
    except Exception as e:
        logger.error(f"Request error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"}
        )

# Health check endpoint
@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "time": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }

# Swagger UI - available only with authentication
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html(current_user = Depends(get_current_user_from_token)):
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Interactive API Docs",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="/static/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui.css",
    )

# Generic error handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Define custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi 