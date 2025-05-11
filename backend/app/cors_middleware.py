from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import FastAPI
from starlette.responses import Response
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)

class CustomCORSMiddleware(BaseHTTPMiddleware):
    """
    Custom CORS middleware that directly adds the required headers
    without relying on environment variables.
    """
    
    def __init__(self, app: ASGIApp, frontend_url: str = "https://alumni-frontend-ybas.onrender.com"):
        super().__init__(app)
        self.frontend_url = frontend_url
        logger.info(f"Initializing custom CORS middleware with frontend URL: {frontend_url}")
    
    async def dispatch(self, request, call_next):
        # Handle CORS preflight requests
        if request.method == "OPTIONS":
            logger.info(f"Processing OPTIONS request from origin: {request.headers.get('origin')}")
            return self._preflight_response(request)
        
        # Process the request and get the response
        response = await call_next(request)
        
        # Add CORS headers to the response
        origin = request.headers.get("origin")
        
        # Allow the frontend domain or localhost for development
        if origin == self.frontend_url or origin == "http://localhost:3000":
            self._add_cors_headers(response, origin)
            logger.info(f"Added CORS headers for origin: {origin}")
        
        return response
    
    def _preflight_response(self, request):
        """Handles OPTIONS requests with appropriate headers"""
        origin = request.headers.get("origin")
        
        # Return empty 204 response for preflight
        response = Response(
            content="",
            status_code=204,
        )
        
        # Add CORS headers if origin is allowed
        if origin == self.frontend_url or origin == "http://localhost:3000":
            self._add_cors_headers(response, origin)
            requested_method = request.headers.get("access-control-request-method")
            requested_headers = request.headers.get("access-control-request-headers")
            
            if requested_method:
                response.headers["access-control-allow-methods"] = requested_method
            
            if requested_headers:
                response.headers["access-control-allow-headers"] = requested_headers
        
        return response
    
    def _add_cors_headers(self, response, origin):
        """Add CORS headers to a response"""
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
        response.headers["access-control-max-age"] = "600"  # Cache preflight for 10 minutes
        response.headers["vary"] = "Origin"  # Important for caching

def add_cors_middleware(app: FastAPI, frontend_url: str = "https://alumni-frontend-ybas.onrender.com"):
    """Add the custom CORS middleware to a FastAPI app"""
    app.add_middleware(CustomCORSMiddleware, frontend_url=frontend_url)
    return app 