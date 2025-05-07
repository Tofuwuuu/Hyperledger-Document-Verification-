import requests
import json

# API URL constants
API_URL = "https://alumni-api-klrk.onrender.com/api/v1"
REGISTER_URL = f"{API_URL}/auth/register"

# Sample user data for registration
test_user = {
    "email": "test123@example.com",
    "full_name": "Test User",
    "password": "TestPass123",
    "confirm_password": "TestPass123",
    "is_active": True,
    "is_admin": False,
    "student_id": "2023-12345",
    "graduation_year": 2023
}

# Headers to simulate browser request
headers = {
    "Origin": "https://alumni-frontend-zzr2.onrender.com",
    "Content-Type": "application/json"
}

print(f"Testing registration endpoint: {REGISTER_URL}")
print(f"Sending data: {json.dumps(test_user, indent=2)}")

try:
    # Test registration endpoint with POST request
    response = requests.post(
        REGISTER_URL, 
        json=test_user,
        headers=headers
    )
    
    # Print response details
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    
    # Handle different response types
    try:
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response Text: {response.text}")
        
except Exception as e:
    print(f"\nError during request: {e}") 