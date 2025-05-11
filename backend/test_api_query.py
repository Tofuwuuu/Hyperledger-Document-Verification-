import asyncio
import httpx
import json
import os
from dotenv import load_dotenv
import sys
import jwt
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Configure the API endpoint
API_URL = "https://alumni-api-klrk.onrender.com/api/v1"  # Change this to your actual API URL
LOCAL_API_URL = "http://localhost:8000/api/v1"  # Local API URL

# Admin user credentials
ADMIN_EMAIL = "joemarlou.opella@cvsu.edu.ph"
ADMIN_PASSWORD = "Admin@123"

def create_admin_bypass_token():
    # Secret key for signing the JWT token
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_for_testing_only")
    
    # Create a token with admin privileges and a long expiration
    payload = {
        "sub": "admin_bypass_" + str(datetime.now().timestamp()),
        "is_admin": True,
        "email": "admin.bypass@example.com",
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
        "admin_bypass": True
    }
    
    # Sign the token
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    # For PyJWT versions that return bytes
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return token

async def test_unverified_users_endpoint(use_local=False):
    # Determine which URL to use
    base_url = LOCAL_API_URL if use_local else API_URL
    url = f"{base_url}/auth/unverified-users"
    
    print(f"Testing unverified users endpoint: {url}")
    
    # Try with an admin bypass token
    admin_token = create_admin_bypass_token()
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
        "X-Admin-Access": "true",
        "X-Admin-Bypass": "true"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First try the regular endpoint
            response = await client.get(url, headers=headers)
            
            print(f"Response status code: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"Users found: {len(data)}")
                    if len(data) > 0:
                        print("\nSample user data:")
                        print(json.dumps(data[0], indent=2))
                    else:
                        print("No users returned (empty array)")
                except Exception as e:
                    print(f"Error parsing response as JSON: {e}")
                    print(f"Raw response text: {response.text[:200]}...")
            else:
                print(f"Error response: {response.text[:200]}...")
                
            # Try with a more specific query
            specific_url = f"{url}?limit=10&db=cvsu_alumni&collection=users"
            print(f"\nTrying with more specific parameters: {specific_url}")
            
            response = await client.get(specific_url, headers=headers)
            
            print(f"Response status code: {response.status_code}")
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"Users found: {len(data)}")
                    if len(data) > 0:
                        print("\nSample user data:")
                        print(json.dumps(data[0], indent=2))
                    else:
                        print("No users returned (empty array)")
                except Exception as e:
                    print(f"Error parsing response as JSON: {e}")
            else:
                print(f"Error response: {response.text[:200]}...")
                
    except Exception as e:
        print(f"Error making API request: {e}")

async def test_login_and_get_token():
    # Determine which URL to use
    base_url = API_URL  # We'll use the production URL for login
    login_url = f"{base_url}/auth/login"
    
    print(f"Testing login endpoint: {login_url}")
    
    # Login data
    login_data = {
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    # Form data for login
    form_data = {
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "remember": "true"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try login
            response = await client.post(
                login_url, 
                data=form_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            print(f"Login response status code: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    token = data.get("access_token")
                    if token:
                        print(f"Successfully obtained token: {token[:10]}...")
                        
                        # Now try to get unverified users with this token
                        unverified_url = f"{base_url}/auth/unverified-users"
                        headers = {
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json"
                        }
                        
                        print(f"\nTrying unverified users endpoint with login token: {unverified_url}")
                        unverified_response = await client.get(unverified_url, headers=headers)
                        
                        print(f"Response status code: {unverified_response.status_code}")
                        if unverified_response.status_code == 200:
                            try:
                                unverified_data = unverified_response.json()
                                print(f"Users found: {len(unverified_data)}")
                                if len(unverified_data) > 0:
                                    print("\nSample user data:")
                                    print(json.dumps(unverified_data[0], indent=2))
                                else:
                                    print("No users returned (empty array)")
                            except Exception as e:
                                print(f"Error parsing response as JSON: {e}")
                        else:
                            print(f"Error response: {unverified_response.text[:200]}...")
                    else:
                        print("No token returned in login response")
                except Exception as e:
                    print(f"Error parsing login response as JSON: {e}")
            else:
                print(f"Login failed: {response.text[:200]}...")
                
    except Exception as e:
        print(f"Error making login API request: {e}")

async def main():
    # Determine if we should use local or production API
    if len(sys.argv) > 1 and sys.argv[1] == "--local":
        use_local = True
    else:
        use_local = False
        
    print("=== Testing Unverified Users API ===")
    await test_unverified_users_endpoint(use_local)
    
    print("\n=== Testing Login and Token Flow ===")
    await test_login_and_get_token()

if __name__ == "__main__":
    asyncio.run(main()) 