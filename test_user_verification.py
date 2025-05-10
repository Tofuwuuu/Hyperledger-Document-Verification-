import requests
import json

# Test the unverified users endpoint
url = 'https://alumni-api-klrk.onrender.com/api/v1/auth/unverified-users'
headers = {
    'Origin': 'https://alumni-frontend-zzr2.onrender.com',
    'Authorization': 'Bearer admin_access_token_bypass_for_testing_only',  # Admin bypass token
    'X-Admin-Bypass': 'true'
}

print(f"Querying URL: {url}")
print(f"With headers: {json.dumps({k:v for k,v in headers.items() if k != 'Authorization'})}")

try:
    # Make the request
    r = requests.get(url, headers=headers)
    
    # Print status code
    print(f'Status: {r.status_code}')
    
    # Print all headers
    print('Response Headers:')
    for k, v in r.headers.items():
        print(f'  {k}: {v}')
    
    # Print response content
    print('\nContent:')
    if r.status_code == 200:
        try:
            data = r.json()
            print(f"Number of unverified users: {len(data)}")
            if len(data) > 0:
                print("\nUnverified users found:")
                for user in data:
                    print(f"ID: {user.get('_id')}, Email: {user.get('email')}, Name: {user.get('full_name')}")
            else:
                print("\nNo unverified users returned by API")
        except json.JSONDecodeError:
            print("Response is not valid JSON")
            print(r.text[:500] if r.text else 'No content')
    else:
        print(r.text[:500] if r.text else 'No content')
    
except Exception as e:
    print(f'Error: {e}')
    
# Now try a direct query to check the MongoDB query predicate
print("\n\nTesting MongoDB query format:")
mongo_test_url = 'https://alumni-api-klrk.onrender.com/api/v1/auth/test-mongo-query'
test_payload = {
    "user_id": "681fa5ae8d75ad66fa728ae7",  # The specific ID you're looking for
    "query": {"$or": [
        {"is_verified": False},
        {"is_verified": {"$exists": False}}
    ]},  # The query being used
    "collection": "users"
}

try:
    # Make the request
    test_r = requests.post(mongo_test_url, json=test_payload, headers=headers)
    print(f"MongoDB Test Status: {test_r.status_code}")
    
    if test_r.status_code == 200:
        try:
            test_data = test_r.json()
            print("MongoDB test results:")
            print(json.dumps(test_data, indent=2))
        except json.JSONDecodeError:
            print("Response is not valid JSON")
            print(test_r.text[:500] if test_r.text else 'No content')
    else:
        print(test_r.text[:500] if test_r.text else 'No content')
        
except Exception as test_e:
    print(f'MongoDB Test Error: {test_e}') 