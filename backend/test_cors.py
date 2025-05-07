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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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