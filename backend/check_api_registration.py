import requests
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API endpoint
API_URL = "http://localhost:8000/api/v1"

# Test user data
test_user = {
    "email": "api_test_user@example.com",
    "full_name": "API Test User",
    "password": "TestPassword123",
    "confirm_password": "TestPassword123",
    "student_id": "87654321",
    "graduation_year": 2022,
    "is_active": True,
    "is_admin": False
}

def test_register_api():
    """Test the registration API endpoint"""
    try:
        logger.info(f"Attempting to register user {test_user['email']} via API...")
        
        # Send registration request
        response = requests.post(
            f"{API_URL}/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"}
        )
        
        # Log response details
        logger.info(f"API Response status code: {response.status_code}")
        
        try:
            response_data = response.json()
            logger.info(f"API Response data: {json.dumps(response_data, indent=2)}")
        except:
            logger.info(f"API Response text: {response.text}")
        
        # Check if registration was successful
        if response.status_code == 200 or response.status_code == 201:
            logger.info("✅ Registration API call successful!")
            return True
        else:
            logger.error(f"❌ Registration API call failed with status {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error testing registration API: {str(e)}")
        return False

def test_login_api():
    """Test the login API endpoint with the test user"""
    try:
        logger.info(f"Attempting to login as {test_user['email']}...")
        
        # Prepare login data
        login_data = {
            "username": test_user['email'],
            "password": test_user['password']
        }
        
        # Send login request as form data (OAuth2 format)
        response = requests.post(
            f"{API_URL}/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        # Log response details
        logger.info(f"Login API Response status code: {response.status_code}")
        
        try:
            response_data = response.json()
            # Mask token values in logs
            if "access_token" in response_data:
                response_data["access_token"] = response_data["access_token"][:10] + "..."
            if "refresh_token" in response_data:
                response_data["refresh_token"] = response_data["refresh_token"][:10] + "..."
            logger.info(f"Login API Response data: {json.dumps(response_data, indent=2)}")
        except:
            logger.info(f"Login API Response text: {response.text}")
        
        # Check if login was successful
        if response.status_code == 200:
            logger.info("✅ Login API call successful!")
            return True
        else:
            logger.error(f"❌ Login API call failed with status {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error testing login API: {str(e)}")
        return False

if __name__ == "__main__":
    # First test the registration API
    registration_result = test_register_api()
    
    # If registration was successful or we want to test login anyway, try logging in
    if registration_result:
        login_result = test_login_api()
        logger.info(f"Login test result: {login_result}")
    else:
        logger.info("Skipping login test since registration failed") 