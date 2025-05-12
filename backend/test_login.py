import requests
import json
import sys

def test_login(username, password):
    """Test the login API endpoint."""
    print(f"Testing login for user: {username}")
    
    # Define the login endpoint URL
    login_url = "http://localhost:8000/api/v1/auth/login"
    
    # Set headers for form submission
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }
    
    # Prepare form data
    data = {
        "username": username,
        "password": password
    }
    
    try:
        # Make the POST request
        response = requests.post(login_url, data=data, headers=headers)
        
        # Check if request was successful
        if response.status_code == 200:
            print("Login successful!")
            response_json = response.json()
            print(f"User: {response_json['user']['email']}")
            print(f"Admin: {response_json['user']['is_admin']}")
            print(f"Verified: {response_json['user']['is_verified']}")
            return True
        else:
            print(f"Login failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"Error occurred during login: {str(e)}")
        return False

if __name__ == "__main__":
    # Default test account
    username = "admin@cvsu.edu.ph"
    password = "password"
    
    # Allow command line arguments for username and password
    if len(sys.argv) > 1:
        username = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    
    test_login(username, password) 