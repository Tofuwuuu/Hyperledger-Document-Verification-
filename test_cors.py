import requests
import json

# Base URL for the API
base_url = 'https://alumni-api-klrk.onrender.com'

# Test OPTIONS request for CORS preflight
def test_options():
    url = f'{base_url}/api/v1/auth/unverified-users'
    headers = {
        'Origin': 'https://alumni-frontend-zzr2.onrender.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, X-Admin-Bypass'
    }
    
    print(f"Making OPTIONS request to: {url}")
    print(f"Headers: {json.dumps(headers)}")
    
    try:
        r = requests.options(url, headers=headers)
        print(f"Status: {r.status_code}")
        print("Response Headers:")
        for k, v in r.headers.items():
            print(f"  {k}: {v}")
        
        # Check for CORS headers
        cors_headers = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers',
            'Access-Control-Allow-Credentials'
        ]
        
        print("\nCORS Header Check:")
        for header in cors_headers:
            value = r.headers.get(header)
            print(f"  {header}: {'✅ ' + value if value else '❌ Missing'}")
            
    except Exception as e:
        print(f"Error: {e}")

# Test actual GET request
def test_get():
    url = f'{base_url}/api/v1/auth/unverified-users'
    headers = {
        'Origin': 'https://alumni-frontend-zzr2.onrender.com',
        'Authorization': 'Bearer admin_access_token_bypass_for_testing_only',
        'X-Admin-Bypass': 'true'
    }
    
    print(f"\nMaking GET request to: {url}")
    print(f"Headers: {json.dumps({k:v for k,v in headers.items() if k != 'Authorization'})}")
    
    try:
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        print("Response Headers:")
        for k, v in r.headers.items():
            print(f"  {k}: {v}")
        
        # Check for CORS headers
        cors_headers = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Credentials',
            'Access-Control-Expose-Headers'
        ]
        
        print("\nCORS Header Check:")
        for header in cors_headers:
            value = r.headers.get(header)
            print(f"  {header}: {'✅ ' + value if value else '❌ Missing'}")
            
        # Print response content
        print("\nResponse Content:")
        try:
            print(json.dumps(r.json(), indent=2))
        except:
            print(r.text[:500] if r.text else '(No content)')
            
    except Exception as e:
        print(f"Error: {e}")

# Test the test-cors endpoint
def test_cors_endpoint():
    url = f'{base_url}/api/v1/auth/test-cors'
    headers = {
        'Origin': 'https://alumni-frontend-zzr2.onrender.com'
    }
    
    print(f"\nTesting CORS test endpoint: {url}")
    print(f"Headers: {json.dumps(headers)}")
    
    try:
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        print("Response Headers:")
        for k, v in r.headers.items():
            print(f"  {k}: {v}")
        
        # Print response content
        try:
            print(json.dumps(r.json(), indent=2))
        except:
            print(r.text[:500] if r.text else '(No content)')
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("=== CORS Test for Unverified Users Endpoint ===\n")
    test_options()
    test_get()
    test_cors_endpoint() 