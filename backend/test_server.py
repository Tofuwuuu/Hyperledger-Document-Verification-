from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import uvicorn

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create minimal FastAPI app
app = FastAPI(title="Test API")

# Configure CORS properly
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # React dev server
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

# Add CORS middleware with proper configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Authorization"]
)

# Direct OPTIONS handler for alumni endpoints
@app.options("/api/v1/alumni/")
async def options_alumni_create(request: Request):
    logger.debug(f"OPTIONS request received for alumni/ from origin: {request.headers.get('origin', 'Unknown')}")
    
    # Get the origin from the request
    origin = request.headers.get("origin", "*")
    
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    logger.debug(f"Returning headers for alumni OPTIONS request: {headers}")
    return JSONResponse(content={}, headers=headers)

# Test POST endpoint
@app.post("/api/v1/alumni/")
async def create_alumni_profile(request: Request):
    try:
        # Get the request body
        body = await request.json()
        logger.debug(f"Received alumni profile data: {body}")
        
        # Return success response
        return JSONResponse(
            content={
                "status": "success",
                "message": "Alumni profile created successfully",
                "data": body
            },
            status_code=201
        )
    except Exception as e:
        logger.error(f"Error creating alumni profile: {str(e)}")
        return JSONResponse(
            content={"detail": f"Error: {str(e)}"},
            status_code=500
        )

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    logger.info("Starting test server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000) 