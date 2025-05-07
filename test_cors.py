import requests

# Test the backend CORS configuration
api_url = "https://alumni-api-klrk.onrender.com/api/v1/auth/test-cors"

# Add origin header to simulate browser request
headers = {
    "Origin": "https://alumni-frontend-zzr2.onrender.com"
}

try:
    # First test with OPTIONS request (preflight)
    options_response = requests.options(api_url, headers=headers)
    print(f"OPTIONS Status Code: {options_response.status_code}")
    print(f"OPTIONS Headers: {dict(options_response.headers)}")
    
    # Then test with GET request
    response = requests.get(api_url, headers=headers)
    print(f"GET Status Code: {response.status_code}")
    print(f"GET Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")
    
except Exception as e:
    print(f"Error: {e}") 