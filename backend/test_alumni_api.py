import requests
import json
import sys

def test_alumni_api():
    """Test the Alumni API endpoint"""
    # Get token from the user
    token = input("Enter your authentication token: ").strip()
    
    if not token:
        print("Error: Token is required")
        return
    
    # Get user ID from the user
    user_id = input("Enter your user ID: ").strip()
    
    if not user_id:
        print("Error: User ID is required")
        return
    
    # Base URL
    base_url = "http://localhost:8000/api/v1"
    
    # Test authentication
    print("\nTesting authentication...")
    try:
        auth_response = requests.get(
            f"{base_url}/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if auth_response.status_code == 200:
            print(f"Authentication successful! User data: {auth_response.json()}")
        else:
            print(f"Authentication failed with status code: {auth_response.status_code}")
            print(f"Response: {auth_response.text}")
            return
    except Exception as e:
        print(f"Error testing authentication: {str(e)}")
        return
    
    # Sample alumni profile data
    profile_data = {
        "user_id": user_id,
        "full_name": "Test Alumni",
        "student_id": "2020-12345",
        "course": "Bachelor of Science in Computer Science",
        "graduation_year": 2023,
        "graduation_month": "April",
        "department": "Information Technology Department",
        "batch": "2023"
    }
    
    # Test creating an alumni profile
    print("\nTesting alumni profile creation...")
    try:
        # Make sure to include the trailing slash
        create_response = requests.post(
            f"{base_url}/alumni/",
            json=profile_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        
        print(f"Status code: {create_response.status_code}")
        
        if create_response.status_code in [200, 201]:
            print("Profile created successfully!")
            print(f"Response: {json.dumps(create_response.json(), indent=2)}")
        else:
            print(f"Failed to create profile. Status code: {create_response.status_code}")
            print(f"Response: {create_response.text}")
    except Exception as e:
        print(f"Error creating alumni profile: {str(e)}")
    
    # Test getting alumni profiles
    print("\nTesting get alumni profiles...")
    try:
        get_response = requests.get(
            f"{base_url}/alumni",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if get_response.status_code == 200:
            alumni_data = get_response.json()
            print(f"Found {len(alumni_data)} alumni profiles")
            
            if len(alumni_data) > 0:
                print("First profile:")
                print(json.dumps(alumni_data[0], indent=2))
        else:
            print(f"Failed to get alumni profiles. Status code: {get_response.status_code}")
            print(f"Response: {get_response.text}")
    except Exception as e:
        print(f"Error getting alumni profiles: {str(e)}")

if __name__ == "__main__":
    print("=== Alumni API Testing Utility ===")
    test_alumni_api() 