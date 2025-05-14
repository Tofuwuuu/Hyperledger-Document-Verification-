#!/usr/bin/env python3
import requests
import json

API_URL = 'http://localhost:8000/api/v1'
TOKEN = 'YOUR_TOKEN_HERE'  # Replace with a real token

def test_alumni_endpoint():
    """Test the alumni API endpoint"""
    url = f"{API_URL}/alumni"
    
    # Test payload
    payload = {
        "user_id": "68236de4d8d6f1393876b83f",  # From error logs
        "full_name": "Test User",
        "student_id": "12345678",
        "email": "test@example.com",
        "graduation_year": 2023
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {TOKEN}'
    }
    
    print(f"Testing API endpoint: POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        try:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Raw response: {response.text}")
    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_alumni_endpoint() 