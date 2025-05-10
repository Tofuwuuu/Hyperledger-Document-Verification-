from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="CORS Debug App")

# Configure CORS with permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://cvsu-alumni.vercel.app",
        "https://alumni-frontend-zzr2.onrender.com",
        "http://alumni-frontend-zzr2.onrender.com",
        "https://final-rkpz.onrender.com",
        "https://alumni-api-klrk.onrender.com",
        "https://alumni-frontend.onrender.com"
    ],
    allow_credentials=True, 
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Admin-Bypass", "X-Requested-With"],
    expose_headers=["Content-Length", "Content-Range"],
    max_age=86400,  # 24 hours
)

# Test endpoint
@app.get("/test-cors")
async def test_cors(request: Request):
    """Simple endpoint to test if CORS is working."""
    # Log request details
    client_host = request.client.host if request.client else "unknown"
    
    logger.info(f"CORS test requested from: {client_host}")
    logger.info(f"Request headers: {dict(request.headers)}")
    
    return {
        "message": "CORS test successful!",
        "timestamp": datetime.utcnow().isoformat(),
        "client_ip": client_host,
        "request_headers": {k: v for k, v in request.headers.items()},
    }

# Test auth endpoint
@app.post("/auth/login")
async def test_login(request: Request):
    """Mock login endpoint for testing."""
    body = await request.body()
    return {
        "message": "Login endpoint reached successfully!",
        "received_data_length": len(body),
        "access_token": "test_access_token",
        "token_type": "bearer",
    }

@app.post("/auth/register")
async def test_register(request: Request):
    """Mock register endpoint for testing."""
    body = await request.body()
    return {
        "message": "Registration endpoint reached successfully!",
        "received_data_length": len(body),
        "user_id": "test_user_123",
    }

@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    """Handle all OPTIONS requests."""
    logger.info(f"OPTIONS request for path: /{path}")
    logger.info(f"OPTIONS request headers: {dict(request.headers)}")
    return {}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    # Log environment info
    logger.info(f"Starting CORS debug server on {host}:{port}")
    logger.info(f"Python version: {os.sys.version}")
    logger.info(f"Current directory: {os.getcwd()}")
    
    # Run the test server
    uvicorn.run(
        "debug_cors:app",
        host=host,
        port=port,
        log_level="info"
    ) 