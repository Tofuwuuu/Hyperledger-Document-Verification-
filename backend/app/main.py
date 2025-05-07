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
        "http://127.0.0.1:3000",
        "*"  # Allow all origins as fallback to ensure frontend works
    ]

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
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # 1 day in seconds
)

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