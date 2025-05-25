from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import logging
import asyncio
import time
from datetime import datetime

from app.routes import auth, alumni, documents, verification, references, events, registrations, meetings, document_requests, users, admin, employers, messages, search, notifications, recruitment
from app.config.database import connect_to_mongo, close_mongo_connection, client, get_database
from app.config.db_init import initialize_database
from app.api.api import api_router
from app.api.routes.notifications import router as notifications_router
from app.core.config import settings
from app.config.init_permissions import init_permissions

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
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development (restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware for request timing and logging
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    
    # Log request info
    logger.info(f"Request started: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        
        # Add processing time header
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log response info
        logger.info(f"Request completed: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.4f}s")
        
        return response
    except Exception as e:
        # Log exceptions
        logger.error(f"Request error: {request.method} {request.url.path} - Error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error occurred"}
        )

# Log API routes for debugging
for route in app.routes:
    logger.info(f"Registered route: {route.path} ({route.name})")

# MongoDB heartbeat function
async def mongo_heartbeat():
    """Send periodic pings to MongoDB to keep connection alive."""
    while True:
        try:
            if client is not None:
                await client.admin.command('ping')
                logger.debug("MongoDB heartbeat ping successful")
            else:
                logger.warning("MongoDB client is None, reconnecting...")
                await connect_to_mongo()
        except Exception as e:
            logger.error(f"Error in MongoDB heartbeat: {e}")
            await connect_to_mongo()
        finally:
            await asyncio.sleep(60)  # Ping every 60 seconds

# Setup events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()
    # Initialize database structure
    await initialize_database()
    await init_permissions()  # Initialize roles and permissions
    # Start the heartbeat task
    asyncio.create_task(mongo_heartbeat())
    logger.info("Application starting up...")

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()
    logger.info("Application shutting down...")

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])
app.include_router(alumni.router, prefix=f"{settings.API_PREFIX}/alumni", tags=["Alumni"])
app.include_router(documents.router, prefix=f"{settings.API_PREFIX}/documents", tags=["Documents"])
app.include_router(verification.router, prefix=f"{settings.API_PREFIX}/verification", tags=["Verification"])
app.include_router(references.router, prefix=f"{settings.API_PREFIX}/references", tags=["References"])
app.include_router(events.router, prefix=f"{settings.API_PREFIX}/events", tags=["Events"])
app.include_router(registrations.router, prefix=f"{settings.API_PREFIX}/registrations", tags=["Registrations"])
app.include_router(meetings.router, prefix=f"{settings.API_PREFIX}/meetings", tags=["Meetings"])
app.include_router(document_requests.router, prefix=f"{settings.API_PREFIX}/document-requests", tags=["Document Requests"])
app.include_router(notifications_router, prefix=f"{settings.API_PREFIX}/notifications", tags=["Notifications"])
app.include_router(users.router, prefix=f"{settings.API_PREFIX}/users", tags=["Users"])
app.include_router(admin.router, prefix=f"{settings.API_PREFIX}/admin", tags=["Admin"])
app.include_router(employers.router, prefix=f"{settings.API_PREFIX}/employers", tags=["Employers"])
app.include_router(recruitment.router, prefix=f"{settings.API_PREFIX}/recruitment", tags=["Recruitment"])
app.include_router(messages.router, prefix=f"{settings.API_PREFIX}/messages", tags=["Messages"])
app.include_router(search.router, prefix=f"{settings.API_PREFIX}/search", tags=["Search"])

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)

# Mount static files for uploaded documents
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/documents", StaticFiles(directory="documents"), name="documents")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to CvSU Alumni System API",
        "version": "1.0",
        "docs": "/docs",
        "time": datetime.utcnow().isoformat()
    }

# Database health check
@app.get("/health")
async def health_check(db=Depends(get_database)):
    try:
        # Check if database connection is working
        info = await db.command("serverStatus")
        
        return {
            "status": "healthy",
            "database": {
                "connected": True,
                "version": info.get("version", "unknown")
            },
            "api_version": "1.0",
            "time": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "database": {
                "connected": False,
                "error": str(e)
            },
            "api_version": "1.0",
            "time": datetime.utcnow().isoformat()
        } 