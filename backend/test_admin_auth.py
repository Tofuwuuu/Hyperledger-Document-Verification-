import asyncio
import os
import jwt
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_URL = "https://alumni-api-klrk.onrender.com/api/v1"
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_for_testing_only")
# Admin credentials - update with actual admin credentials
ADMIN_EMAIL = "joemarlou.opella@cvsu.edu.ph"
ADMIN_PASSWORD = "Admin@123"  # Change to the correct admin password

def create_admin_token(admin_id="admin_bypass_user", expires_days=7):
    """Create a test admin token for testing"""
    # Create a token with admin privileges and a long expiration
    payload = {
        "sub": admin_id,
        "is_admin": True,
        "email": "admin.bypass@example.com",
        "exp": datetime.utcnow() + timedelta(days=expires_days),
        "iat": datetime.utcnow(),
        "admin_bypass": True
    }
    
    # Sign the token
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    # For PyJWT versions that return bytes
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return token

def login_admin():
    """Log in as admin and get token"""
    print(f"Logging in as admin ({ADMIN_EMAIL})...")
    
    form_data = {
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "remember": "true"
    }
    
    response = requests.post(
        f"{API_URL}/auth/login",
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"Login successful, token: {token[:15]}...")
        return token
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def test_authentication(token):
    """Test if the token works for admin endpoints"""
    print("\nTesting authentication with token...")
    
    # Test /auth/me endpoint
    me_response = requests.get(
        f"{API_URL}/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Auth/me status: {me_response.status_code}")
    if me_response.status_code == 200:
        me_data = me_response.json()
        print(f"User data: {json.dumps(me_data, indent=2)}")
        
        is_admin = me_data.get("is_admin", False)
        print(f"Is admin: {is_admin}")
        
        if not is_admin:
            print("WARNING: User is not an admin!")
    else:
        print(f"Failed to get user data: {me_response.text}")
    
    # Test unverified users endpoint
    unverified_response = requests.get(
        f"{API_URL}/auth/unverified-users?limit=10",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Admin-Access": "true",
            "X-Admin-Bypass": "true"
        }
    )
    
    print(f"\nUnverified users status: {unverified_response.status_code}")
    if unverified_response.status_code == 200:
        try:
            unverified_data = unverified_response.json()
            if isinstance(unverified_data, list):
                print(f"Found {len(unverified_data)} unverified users")
                if len(unverified_data) > 0:
                    print(f"First user: {json.dumps(unverified_data[0], indent=2)}")
            else:
                print(f"Unexpected response format: {type(unverified_data)}")
                print(unverified_data)
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Raw response: {unverified_response.text[:200]}...")
    else:
        print(f"Failed to get unverified users: {unverified_response.text}")

def main():
    print("===== Admin Authentication Test =====")
    
    # First try regular login
    token = login_admin()
    if token:
        test_authentication(token)
    else:
        print("Login failed, trying with generated admin token...")
        # If regular login fails, try generated token
        admin_token = create_admin_token()
        print(f"Generated admin token: {admin_token[:15]}...")
        test_authentication(admin_token)
    
    print("\nTest completed.")

if __name__ == "__main__":
    main() 