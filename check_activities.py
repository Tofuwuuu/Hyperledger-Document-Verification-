import requests
import json

# Token from localStorage
token = input("Enter your JWT token from localStorage: ")

# Base URL
base_url = "http://localhost:8000/api/v1"

# Endpoint to test
endpoint = "/documents/activities"

# Headers
headers = {
    "Authorization": f"Bearer {token}",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache"
}

# Make the request
try:
    response = requests.get(f"{base_url}{endpoint}", headers=headers)
    
    # Print response details
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {json.dumps(dict(response.headers), indent=2)}")
    
    if response.status_code == 200:
        # Parse JSON response
        data = response.json()
        print(f"Response Data: {json.dumps(data, indent=2)}")
        print(f"Number of activities: {len(data)}")
    else:
        print(f"Error Response: {response.text}")
        
except Exception as e:
    print(f"Error making request: {str(e)}")

# Check if the endpoint is registered in FastAPI
print("\nChecking if endpoint is registered in FastAPI...")
try:
    openapi_response = requests.get(f"{base_url.split('/api')[0]}/openapi.json")
    if openapi_response.status_code == 200:
        openapi_data = openapi_response.json()
        paths = openapi_data.get("paths", {})
        
        # Check if our endpoint exists
        if f"/api/v1{endpoint}" in paths:
            print(f"✅ Endpoint {endpoint} is registered in FastAPI")
        else:
            found = False
            for path in paths:
                if endpoint in path:
                    print(f"❓ Similar endpoint found: {path}")
                    found = True
            
            if not found:
                print(f"❌ Endpoint {endpoint} is NOT registered in FastAPI")
                print("Available endpoints:")
                for path in sorted(paths.keys()):
                    if "/documents/" in path:
                        print(f"  - {path}")
    else:
        print(f"Could not get OpenAPI schema: {openapi_response.status_code}")
except Exception as e:
    print(f"Error checking OpenAPI schema: {str(e)}") 