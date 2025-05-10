import requests

# Test the OPTIONS request for the alumni endpoint
url = 'https://alumni-api-klrk.onrender.com/api/v1/alumni/?limit=20&offset=0'
headers = {
    'Origin': 'https://alumni-frontend-zzr2.onrender.com',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Content-Type,Authorization'
}

try:
    # Make the OPTIONS request
    r = requests.options(url, headers=headers)
    
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