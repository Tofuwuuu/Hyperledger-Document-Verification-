"""
CORS Fix Script - Run this to add CORS headers to your FastAPI app

This script shows a minimal example of handling CORS properly in FastAPI.
You can copy the key parts into your main.py file.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 1. Configure CORS with all necessary origins
app = FastAPI()

# Configure origins - include all your frontend URLs
origins = [
    "http://localhost:5173",  # Vite dev server default
    "http://localhost:3000",  # React dev server default
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    # Production URLs
    "https://alumni-frontend-zzr2.onrender.com",
    "https://cvsu-alumni.netlify.app",
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Set origins to your frontend URLs
    allow_credentials=True, # This is needed for cookies/auth
    allow_methods=["*"],    # Allow all methods
    allow_headers=["*"],    # Allow all headers
)

# 2. Add preflight handlers for specific routes if needed
@app.options("/api/v1/alumni/")
async def alumni_options(request: Request):
    origin = request.headers.get("origin", origins[0])
    
    # Check if the origin is allowed
    if origin not in origins:
        origin = origins[0]  # Default to first origin
    
    # Return CORS headers
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
    
    return JSONResponse(content={}, headers=headers)

# 3. Test that CORS is working
@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working!"}

"""
HOW TO USE THIS SCRIPT:

1. You should add the CORSMiddleware to your main FastAPI app as shown above.
2. Add specific OPTIONS handlers for endpoints that need them.
3. Make sure your frontend calls include:
   - The correct Content-Type header
   - Authorization header with Bearer token if needed
   - withCredentials: true if using cookies/auth

Example frontend code:

```javascript
const response = await fetch('http://localhost:8000/api/v1/alumni/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  credentials: 'include', // Important for auth cookies
  body: JSON.stringify(data)
});
```
""" 