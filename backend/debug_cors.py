from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="CORS Debug App")

# Configure CORS with the most permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Test endpoint
@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS test successful!"}

# Test endpoint with parameters
@app.post("/test-post")
async def test_post(data: dict):
    return {"message": "POST request successful!", "received": data}

if __name__ == "__main__":
    # Check the environment
    logger.info(f"Python version: {os.sys.version}")
    logger.info(f"Current directory: {os.getcwd()}")
    
    # Run the test server
    logger.info("Starting CORS debug server...")
    uvicorn.run(
        "debug_cors:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        log_level="info"
    ) 