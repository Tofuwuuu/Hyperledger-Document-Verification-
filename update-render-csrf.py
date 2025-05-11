import requests
import base64
import json
import os
from getpass import getpass

# The script for directly updating a file on Render via API
# This requires your Render API key

def update_csrf_file():
    # Get your Render API key (you'll need to create one in your Render dashboard)
    api_key = os.environ.get('RENDER_API_KEY') or getpass("Enter your Render API key: ")
    
    # Service ID from Render dashboard (different from service name)
    service_id = input("Enter your Render service ID (from the dashboard URL): ")
    
    # File content with the fixes
    file_content = """from typing import Optional
from fastapi import Request, HTTPException, status, Depends
import logging
import secrets

# Get logger
logger = logging.getLogger(__name__)

# CSRF constants
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_COOKIE_NAME = "csrf_token"

def generate_csrf_token() -> str:
    \"\"\"Generate a new CSRF token\"\"\"
    return secrets.token_hex(32)

def csrf_cookie(request: Request) -> Optional[str]:
    \"\"\"Get the CSRF token from the cookie\"\"\"
    return request.cookies.get(CSRF_COOKIE_NAME)

def verify_csrf_token(header_token: str, cookie_token: str) -> bool:
    \"\"\"Verify that the CSRF token in the header matches the one in the cookie\"\"\"
    return header_token == cookie_token

async def csrf_protect(
    request: Request,
    csrf_cookie_token: Optional[str] = Depends(csrf_cookie)
) -> None:
    \"\"\"CSRF protection middleware for protected routes\"\"\"
    # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return

    # Check URL path to bypass CSRF for specific endpoints
    request_path = request.url.path
    logger.info(f"CSRF check for path: {request_path}")
    
    # Skip CSRF for event and registration endpoints
    if "events" in request_path or "registrations" in request_path:
        logger.info(f"CSRF protection BYPASSED for event/registration path: {request_path}")
        return
    
    # Skip CSRF for admin endpoints
    if request_path.startswith("/api/v1/admin/"):
        logger.info(f"CSRF protection BYPASSED for admin path: {request_path}")
        return

    # Get CSRF token from header
    csrf_header = request.headers.get(CSRF_HEADER_NAME)

    # Verify CSRF token
    if not csrf_cookie_token or not csrf_header or not verify_csrf_token(csrf_header, csrf_cookie_token):
        logger.warning(f"CSRF validation FAILED - Header: {bool(csrf_header)}, Cookie: {bool(csrf_cookie_token)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )"""
    
    # API endpoint to run exec command on the Render service
    url = f"https://api.render.com/v1/services/{service_id}/exec"
    
    # Base64 encode the file content
    encoded_content = base64.b64encode(file_content.encode()).decode()
    
    # Prepare the command to create/update the file
    command = f'echo "{encoded_content}" | base64 -d > /opt/render/project/src/backend/app/utils/csrf.py'
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "command": command
    }
    
    print("Sending update request to Render...")
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    
    if response.status_code == 200:
        print("Successfully updated CSRF file on Render!")
        print("Now restart your service from the Render dashboard")
    else:
        print(f"Failed to update file. Status code: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    update_csrf_file() 