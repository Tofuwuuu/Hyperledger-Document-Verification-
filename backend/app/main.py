from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import logging
import asyncio
from fastapi.responses import JSONResponse

from app.routes import auth, alumni, documents, verification, references, events, registrations, meetings, document_requests
from app.config.database import connect_to_mongo, close_mongo_connection, client
from app.config.db_init import initialize_database
from app.config.indexes import create_indexes
from app.api.api import api_router
from app.api.routes.notifications import router as notifications_router
from app.core.config import settings
from app.config.init_permissions import init_permissions
from app.utils.csrf import csrf_protect

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    swagger_ui_parameters={"tryItOutEnabled": True},
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://alumni-frontend-zzr2.onrender.com",  # Production frontend
        "https://alumni-frontend.onrender.com",       # Alternative production frontend
        "http://localhost:3000",                      # Local development React
        "http://localhost:5173",                      # Vite development
        "http://localhost:5174",                      # Alternative Vite port
        "http://127.0.0.1:5173",                      # Alternative local
        "http://127.0.0.1:5174",                      # Alternative local
        "http://127.0.0.1:3000"                       # Alternative local React
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type", 
        "Authorization", 
        "Accept", 
        "X-CSRF-Token", 
        "X-Requested-With",
        "X-Admin-Bypass",
        "X-Admin-Access",
        "X-Use-Local-User",
        "Cache-Control",
        "Pragma",
        "Accept-Encoding",
        "Accept-Language",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["Content-Length", "Content-Range", "X-CSRF-Token", "Access-Control-Allow-Origin"],
    max_age=86400,  # 1 day in seconds
)

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Special handling for OPTIONS requests
    if request.method == "OPTIONS":
        # For preflight requests, return a proper response with CORS headers
        # Get the requested headers from the request
        requested_headers = request.headers.get("Access-Control-Request-Headers", "")
        requested_method = request.headers.get("Access-Control-Request-Method", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        origin = request.headers.get("Origin", "")
        
        # Check if the origin is in the list of allowed origins
        allowed_origins = [
            "https://alumni-frontend-zzr2.onrender.com",
            "https://alumni-frontend.onrender.com",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:3000"
        ]
        
        # If origin is allowed or empty (will be rejected by the browser anyway)
        if origin in allowed_origins or not origin:
            # Use the requested headers if present, otherwise use our default list
            allow_headers = requested_headers if requested_headers else "Content-Type, Authorization, Accept, X-CSRF-Token, X-Requested-With, X-Admin-Bypass, X-Admin-Access, X-Use-Local-User, Cache-Control, Pragma, Accept-Encoding, Accept-Language, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
            
            headers = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": requested_method,
                "Access-Control-Allow-Headers": allow_headers,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
                "Content-Type": "text/plain",
                "Content-Length": "0",
            }
            return JSONResponse(content={}, status_code=200, headers=headers)
        
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Ensure CORS headers are preserved
    if "access-control-allow-origin" not in response.headers and "origin" in request.headers:
        origin = request.headers.get("origin")
        allowed_origins = [
            "https://alumni-frontend-zzr2.onrender.com",
            "https://alumni-frontend.onrender.com",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:3000"
        ]
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# Add CSRF middleware
@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """Middleware to handle CSRF protection for non-GET methods"""
    # Skip CSRF check for safe methods (including OPTIONS)
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)
    
    # Skip CSRF for specified paths (like login, which can't have CSRF yet)
    skip_paths = [
        "/api/v1/auth/login", 
        "/api/v1/auth/register", 
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-reset-token",
        "/api/v1/auth/reset-password-confirm",
        "/api/v1/admin/"  # Skip for all admin endpoints
    ]
    
    for path in skip_paths:
        if request.url.path.startswith(path):
            return await call_next(request)
    
    # Get CSRF token from header and cookie
    csrf_header = request.headers.get("X-CSRF-Token")
    csrf_cookie = request.cookies.get("csrf_token")
    
    # If token is missing, return 403
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        return JSONResponse(
            status_code=403,
            content={"detail": "CSRF token missing or invalid"}
        )
    
    # Continue with the request
    return await call_next(request)

# MongoDB heartbeat function
async def mongo_heartbeat():
    """
    Send periodic pings to MongoDB to keep connection alive.
    This function also handles reconnection attempts if the connection is lost.
    """
    retry_interval = 60  # Start with 60 seconds between retries
    max_retry_interval = 300  # Maximum 5 minutes between retries
    
    while True:
        try:
            if client is not None:
                try:
                    await client.admin.command('ping')
                    logger.debug("MongoDB heartbeat ping successful")
                    # Reset retry interval on success
                    retry_interval = 60
                except Exception as e:
                    logger.error(f"MongoDB heartbeat ping failed: {e}")
                    logger.info("Attempting to reconnect to MongoDB...")
                    await connect_to_mongo()
            else:
                logger.warning("MongoDB client is None, attempting to reconnect...")
                connection_success = await connect_to_mongo()
                
                if connection_success:
                    logger.info("Successfully reconnected to MongoDB")
                    retry_interval = 60  # Reset retry interval on successful reconnection
                else:
                    # Use exponential backoff with a maximum
                    retry_interval = min(retry_interval * 1.5, max_retry_interval)
                    logger.warning(f"Reconnection failed, will retry in {int(retry_interval)} seconds")
        except Exception as e:
            logger.error(f"Error in MongoDB heartbeat task: {e}")
            # Increase retry interval on errors
            retry_interval = min(retry_interval * 1.5, max_retry_interval)
        finally:
            await asyncio.sleep(retry_interval)  # Wait before next ping/reconnection attempt

# Setup events
@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup."""
    # Clear handlers to prevent duplicated logs 
    logging.getLogger("uvicorn").handlers.clear()
    
    # Set up MongoDB connection
    logging.info("Starting application, connecting to MongoDB...")
    
    # Connect to MongoDB
    connected = await connect_to_mongo()
    
    # Add enhanced logging for MongoDB
    if connected:
        logging.info("MongoDB connection successful!")
        
        # Log MongoDB version to verify we're connecting to the right database
        try:
            db = get_database()
            if db is not None:  # Using proper check
                server_info = await db.command("serverStatus")
                version = server_info.get("version", "Unknown")
                logging.info(f"Connected to MongoDB version: {version}")
                
                # Log collection stats
                collections = await db.list_collection_names()
                logging.info(f"Available collections: {collections}")
                
                # Check for unverified users to help with debugging
                try:
                    unverified_count = await db.users.count_documents({"is_verified": False})
                    logging.info(f"Found {unverified_count} unverified users in database")
                except Exception as e:
                    logging.error(f"Error checking unverified users: {e}")
            else:
                logging.error("Database connection object is None despite successful connection")
        except Exception as e:
            logging.error(f"Error getting MongoDB server info: {e}")
    else:
        logging.error("Failed to connect to MongoDB during startup")

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()
    logger.info("Application shutting down...")

# Include routers
app.include_router(auth.router, prefix=settings.API_PREFIX, tags=["Authentication"])
app.include_router(alumni.router, prefix=settings.API_PREFIX, tags=["Alumni"])
app.include_router(documents.router, prefix=settings.API_PREFIX, tags=["Documents"])
app.include_router(verification.router, prefix=settings.API_PREFIX, tags=["Verification"])
app.include_router(references.router, prefix=settings.API_PREFIX, tags=["References"])
app.include_router(events.router, prefix=settings.API_PREFIX, tags=["Events"])
app.include_router(registrations.router, prefix=settings.API_PREFIX, tags=["Registrations"])
app.include_router(meetings.router, prefix=settings.API_PREFIX, tags=["Meetings"])
app.include_router(document_requests.router, prefix=f"{settings.API_PREFIX}/document-requests", tags=["Document Requests"])
app.include_router(notifications_router, prefix=settings.API_PREFIX, tags=["Notifications"])

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)

# Mount static files for uploaded documents
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to CVSU-Carmona Alumni Document Verification System API",
        "documentation": "/docs",
    }

@app.middleware("http")
async def fix_content_length(request: Request, call_next):
    """Middleware to fix Content-Length issues"""
    response = await call_next(request)
    
    # Check if Content-Length is set and response has a body
    if "content-length" in response.headers and not isinstance(response, JSONResponse):
        try:
            # For non-JSON responses, remove the Content-Length header to let the server set it correctly
            # Based on the response body length when it's sent
            del response.headers["content-length"]
        except Exception as e:
            logger.error(f"Error removing Content-Length header: {e}")
            
    return response 