import requests
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_register():
    url = "http://localhost:8000/api/v1/auth/register"
    
    # Test user data
    user_data = {
        "email": "test_user@example.com",
        "full_name": "Test User",
        "password": "Password123",
        "confirm_password": "Password123",
        "student_id": "2023-12345",
        "graduation_year": 2023,
        "is_active": True,
        "is_admin": False
    }
    
    try:
        logger.info(f"Sending registration request to: {url}")
        logger.info(f"Request payload: {json.dumps(user_data, indent=2)}")
        
        response = requests.post(url, json=user_data)
        
        logger.info(f"Response status code: {response.status_code}")
        
        if response.status_code == 201:
            logger.info("Registration successful!")
            logger.info(f"Response data: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            logger.error(f"Registration failed! Status code: {response.status_code}")
            if response.text:
                try:
                    logger.error(f"Response data: {json.dumps(response.json(), indent=2)}")
                except:
                    logger.error(f"Response text: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error: {e}")
        logger.error("Is the backend server running?")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    test_register() 