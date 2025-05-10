import requests

# Test the admin dashboard health endpoint
url = 'https://alumni-api-klrk.onrender.com/api/v1/admin/dashboard/health'
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
    
    # Print response content
    print('\nContent:')
    print(r.text)
    
except Exception as e:
    print(f'Error: {e}') 