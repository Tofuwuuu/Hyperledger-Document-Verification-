import aiohttp
import asyncio
import json

async def test_api():
    """Test the API directly by making HTTP requests"""
    print("Testing API directly...")
    
    # API base URL
    base_url = "http://localhost:8000/api/v1"
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Login as employer
        print("\n=== TESTING EMPLOYER LOGIN ===")
        login_data = {
            "username": "test@employer.com",
            "password": "password123"
        }
        
        login_url = f"{base_url}/employers/login"
        print(f"Making POST request to {login_url}")
        
        # Use form data for login
        login_form = aiohttp.FormData()
        login_form.add_field("username", login_data["username"])
        login_form.add_field("password", login_data["password"])
        
        async with session.post(login_url, data=login_form) as response:
            status = response.status
            response_text = await response.text()
            
            print(f"Login status: {status}")
            print(f"Response: {response_text}")
            
            if status != 200:
                print("Login failed, cannot continue API tests")
                return
            
            # Parse the response to get the token
            response_data = json.loads(response_text)
            token = response_data.get("access_token")
            
            if not token:
                print("No access token received, cannot continue API tests")
                return
            
            print(f"Received access token: {token[:10]}...")
        
        # Step 2: Get employer jobs
        print("\n=== TESTING GET EMPLOYER JOBS ===")
        jobs_url = f"{base_url}/employers/jobs"
        print(f"Making GET request to {jobs_url}")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        async with session.get(jobs_url, headers=headers) as response:
            status = response.status
            response_text = await response.text()
            
            print(f"Get jobs status: {status}")
            
            if status == 200:
                # Parse and display jobs
                jobs_data = json.loads(response_text)
                print(f"Found {len(jobs_data)} jobs:")
                for i, job in enumerate(jobs_data):
                    print(f"\nJob #{i+1}:")
                    print(f"  Title: {job.get('title')}")
                    print(f"  Employer ID: {job.get('employer_id')}")
                    print(f"  ID: {job.get('id')}")
            else:
                print(f"Get jobs failed with response: {response_text}")
                
        # Step 3: Create a new job
        print("\n=== TESTING CREATE JOB ===")
        create_job_url = f"{base_url}/employers/jobs"
        print(f"Making POST request to {create_job_url}")
        
        job_data = {
            "title": "API Test Job",
            "description": "This job was created by the API test script",
            "location": "API Test Location",
            "skills": ["API Testing", "Python"],
            "employment_type": "full-time"
        }
        
        async with session.post(create_job_url, headers=headers, json=job_data) as response:
            status = response.status
            response_text = await response.text()
            
            print(f"Create job status: {status}")
            
            if status == 201:
                job_response = json.loads(response_text)
                print(f"Job created with ID: {job_response.get('id')}")
            else:
                print(f"Create job failed with response: {response_text}")

if __name__ == "__main__":
    print("Starting API tests...")
    asyncio.run(test_api()) 