import requests
import sys

def test_endpoint(url):
    print(f"\nTesting endpoint: {url}")
    try:
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        print("Headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        print("\nContent:")
        print(response.text[:200])  # Print first 200 chars
        return response.status_code
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    base_url = "http://localhost:8000"
    
    endpoints = [
        f"{base_url}/api/v1/healthcheck",
        f"{base_url}/api/v1/auth/test",
        f"{base_url}/api/v1/users/test",
    ]
    
    for url in endpoints:
        status = test_endpoint(url)
    
if __name__ == "__main__":
    main() 