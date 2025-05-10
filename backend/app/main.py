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

# Get CORS origins from environment or use defaults
cors_origins = [
    "https://alumni-frontend-zzr2.onrender.com",  # Production frontend
    "http://localhost:3000",  # Local development
    "http://localhost:5173",  # Vite development
    "http://127.0.0.1:5173"   # Alternative local
]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Admin-Bypass", "X-Requested-With", "X-CSRF-Token"],
    expose_headers=["Content-Length", "Content-Range"],
    max_age=86400,  # 1 day in seconds
)

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Add CSRF middleware
async def csrf_middleware(request: Request, call_next):
    """Middleware to handle CSRF protection for non-GET methods"""
    # Skip CSRF check for safe methods
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)
    
    # Skip CSRF for specified paths (like login, which can't have CSRF yet)
    skip_paths = [
        "/api/v1/auth/login", 
        "/api/v1/auth/register", 
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-reset-token",
        "/api/v1/auth/reset-password-confirm"
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

app.middleware("http")(csrf_middleware)

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
    """
    Connect to the database and initialize startup services.
    This function handles database connection, database initialization,
    and starts background tasks.
    """
    logger.info("Application starting up...")
    
    # Attempt to connect to MongoDB
    connection_success = await connect_to_mongo()
    
    if connection_success:
        try:
            # Initialize database structure
            await initialize_database()
            # Create database indexes for performance
            await create_indexes()
            # Initialize roles and permissions
            await init_permissions()
            logger.info("Database initialization completed successfully")
        except Exception as e:
            logger.error(f"Error during database initialization: {e}")
            logger.warning("Continuing with limited functionality")
    else:
        logger.warning("Database connection failed, starting with limited functionality")
        
    # Start the heartbeat task - this will try to reconnect if needed
    asyncio.create_task(mongo_heartbeat())
    
    logger.info("Application startup completed")

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