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
from app.config.indexes import create_indexes
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

# Configure CORS from settings/env
origins = settings.get_cors_origins()
logger.info(f"CORS origins: {origins}")

# Configure the CORS middleware with correct settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=["Content-Type", "Authorization"],
    max_age=86400,
)

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """
    Dev-first CSRF: enforce only when ENABLE_CSRF=true.
    Uses a double-submit token: cookie `csrf_token` and header `X-CSRF-Token` must match.
    """
    if not settings.ENABLE_CSRF:
        return await call_next(request)

    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    # Allow unauthenticated entrypoints without CSRF
    skip_paths = (
        f"{settings.API_PREFIX}/auth/login",
        f"{settings.API_PREFIX}/auth/register",
        f"{settings.API_PREFIX}/auth/reset-password",
        f"{settings.API_PREFIX}/auth/verify-reset-token",
        f"{settings.API_PREFIX}/auth/reset-password-confirm",
        f"{settings.API_PREFIX}/auth/csrf-token",
    )
    if any(request.url.path.startswith(p) for p in skip_paths):
        return await call_next(request)

    csrf_header = request.headers.get("X-CSRF-Token")
    csrf_cookie = request.cookies.get("csrf_token")
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        return JSONResponse(status_code=403, content={"detail": "CSRF token missing or invalid"})

    return await call_next(request)

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)

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
        await create_indexes()
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