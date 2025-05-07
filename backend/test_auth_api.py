import requests
import json
import argparse
import sys
import time

def test_register(base_url, email, password, student_id, year_graduated, department, course):
    """Test the registration endpoint"""
    url = f"{base_url}/api/v1/auth/register"
    
    # Registration data
    data = {
        "email": email,
        "full_name": "Test User",
        "password": password,
        "is_active": True,
        "is_admin": False,
        "student_id": student_id,
        "year_graduated": year_graduated,
        "department": department,
        "course": course
    }
    
    # First, do an OPTIONS request to check CORS
    print(f"\n--- Testing OPTIONS request to {url} ---")
    headers = {
        "Origin": "https://alumni-frontend-zzr2.onrender.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    
    try:
        options_response = requests.options(url, headers=headers, timeout=10)
        print(f"Status Code: {options_response.status_code}")
        print("Response Headers:")
        for key, value in options_response.headers.items():
            print(f"  {key}: {value}")
        
        # Check CORS headers
        if "Access-Control-Allow-Origin" in options_response.headers:
            print("\n✅ Access-Control-Allow-Origin header is present")
        else:
            print("\n❌ Access-Control-Allow-Origin header is MISSING")
            
        if "Access-Control-Allow-Methods" in options_response.headers:
            print("✅ Access-Control-Allow-Methods header is present")
        else:
            print("❌ Access-Control-Allow-Methods header is MISSING")
            
        if "Access-Control-Allow-Headers" in options_response.headers:
            print("✅ Access-Control-Allow-Headers header is present")
        else:
            print("❌ Access-Control-Allow-Headers header is MISSING")
    
    except Exception as e:
        print(f"ERROR during OPTIONS request: {e}")
    
    # Now try the actual registration
    print(f"\n--- Testing POST request to {url} ---")
    headers = {
        "Origin": "https://alumni-frontend-zzr2.onrender.com",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print("Response Headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        
        # Print response body
        try:
            print("\nResponse Body:")
            print(json.dumps(response.json(), indent=2))
        except:
            print(f"Response Body: {response.text[:500]}")
        
    except Exception as e:
        print(f"ERROR during POST request: {e}")

def main():
    parser = argparse.ArgumentParser(description="Test the authentication API for CORS issues")
    parser.add_argument("--url", default="https://alumni-api-klrk.onrender.com", help="Base URL for the API")
    parser.add_argument("--email", default="testuser@example.com", help="Email for registration")
    parser.add_argument("--password", default="Testpassword123", help="Password for registration")
    parser.add_argument("--student-id", default="TEST12345", help="Student ID")
    parser.add_argument("--year", type=int, default=2023, help="Graduation year")
    parser.add_argument("--department", default="Computer Science", help="Department")
    parser.add_argument("--course", default="Computer Science", help="Course")
    
    args = parser.parse_args()
    
    print("Testing Authentication API for CORS issues...")
    print(f"API URL: {args.url}")
    
    # Run tests
    test_register(
        args.url, 
        args.email, 
        args.password, 
        args.student_id, 
        args.year, 
        args.department, 
        args.course
    )
    
if __name__ == "__main__":
    main() 