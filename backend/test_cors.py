import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CORS Test")

# Configure CORS with very permissive settings for testing
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
    max_age=86400,  # 1 day in seconds
)

@app.get("/test")
async def test_cors(request: Request):
    """Endpoint to test CORS configuration"""
    logger.info(f"Headers: {dict(request.headers)}")
    return {
        "message": "CORS test successful",
        "headers": dict(request.headers),
    }

@app.post("/test-post")
async def test_post(request: Request):
    """Endpoint to test POST requests with CORS"""
    body = await request.body()
    return {
        "message": "POST request successful",
        "headers": dict(request.headers),
        "body_length": len(body)
    }

@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    """Handle all OPTIONS requests and log them"""
    logger.info(f"OPTIONS request for path: /{path}")
    logger.info(f"Headers: {dict(request.headers)}")
    return {}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting CORS test server on {host}:{port}")
    uvicorn.run("test_cors:app", host=host, port=port, reload=True) 