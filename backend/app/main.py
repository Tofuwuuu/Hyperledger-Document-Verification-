from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import logging
import asyncio

from app.routes import auth, alumni, documents, verification, references, events, registrations, meetings, document_requests
from app.config.database import connect_to_mongo, close_mongo_connection, client
from app.config.db_init import initialize_database
from app.config.indexes import create_indexes
from app.api.api import api_router
from app.api.routes.notifications import router as notifications_router
from app.core.config import settings
from app.config.init_permissions import init_permissions

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get CORS origins from environment or use defaults
# First try environment variable, then fallback to a list with explicit domains
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = cors_origins_env.split(",")
else:
    # Explicitly list all known frontend domains
    cors_origins = [
        "https://alumni-frontend-zzr2.onrender.com",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
        # Remove wildcard to enhance security
    ]

# Ensure critical production domains are always included
if "https://alumni-frontend-zzr2.onrender.com" not in cors_origins:
    cors_origins.append("https://alumni-frontend-zzr2.onrender.com")

logger.info(f"Configuring CORS with origins: {cors_origins}")

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

# Configure CORS - Make sure this is the FIRST middleware added
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://alumni-frontend.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Admin-Bypass", "X-Requested-With"],
    expose_headers=["Content-Length", "Content-Range"],
    max_age=86400,  # 1 day in seconds
)

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