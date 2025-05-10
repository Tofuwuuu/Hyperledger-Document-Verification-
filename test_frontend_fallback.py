import requests

# Test the simplified alumni list endpoint (which should have been deployed in our previous commits)
url = 'https://alumni-api-klrk.onrender.com/api/v1/alumni/list?limit=5&offset=0'
headers = {'Origin': 'https://alumni-frontend-zzr2.onrender.com'}

try:
    # Make the request
    r = requests.get(url, headers=headers)
    
    # Print status code
    print(f'Status: {r.status_code}')
    
    # Print all headers
    print('Headers:')
    for k, v in r.headers.items():
        print(f'  {k}: {v}')
    
    # Print response content (truncated if too long)
    print('\nContent (truncated):')
    print(r.text[:500] if r.text else 'No content')
    
except Exception as e:
    print(f'Error: {e}') 