import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from passlib.context import CryptContext

# Password hashing utility
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

async def create_test_data():
    """Create sample document requests in the database"""
    
    print(f"Connecting to MongoDB at {MONGODB_URL}")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB]
    
    # First, get a sample alumni record (or create one if none exists)
    alumni = await db.alumni.find_one({})
    
    if not alumni:
        print("No alumni found, creating sample alumni...")
        sample_alumni = {
            "user_id": str(ObjectId()),
            "full_name": "John Sample",
            "student_id": "2023-12345",
            "course": "Computer Science",
            "graduation_year": 2023,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.alumni.insert_one(sample_alumni)
        alumni_id = str(result.inserted_id)
        print(f"Created sample alumni with ID: {alumni_id}")
    else:
        alumni_id = str(alumni["_id"])
        print(f"Using existing alumni: {alumni.get('full_name', 'Unknown')} (ID: {alumni_id})")
    
    # Create sample document requests
    sample_requests = [
        {
            "alumni_id": alumni_id,
            "document_type": "good_moral",
            "purpose": "Employment application",
            "status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "alumni_id": alumni_id,
            "document_type": "certification",
            "purpose": "Graduate studies",
            "status": "processing",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "admin_notes": "Processing this request, will be ready tomorrow"
        },
        {
            "alumni_id": alumni_id,
            "document_type": "enrollment",
            "purpose": "Scholarship application",
            "status": "completed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
            "document_id": str(ObjectId())
        },
        {
            "alumni_id": alumni_id,
            "document_type": "good_moral",
            "purpose": "Visa application",
            "status": "rejected",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "rejection_reason": "Incomplete information provided"
        }
    ]
    
    # Insert sample document requests
    result = await db.document_requests.insert_many(sample_requests)
    print(f"Created {len(result.inserted_ids)} sample document requests")
    
    # Close connection
    client.close()
    print("Done!")

async def create_test_employer():
    print("Creating test employer...")
    
    # Check if employer already exists
    existing = await db.employers.find_one({"email": "test@employer.com"})
    if existing:
        print(f"Test employer already exists with ID: {existing['_id']}")
        return existing['_id']
    
    # Create employer document
    employer_data = {
        "email": "test@employer.com",
        "hashed_password": pwd_context.hash("password123"),
        "company_name": "Test Company",
        "industry": "Technology",
        "contact_person": "Test Person",
        "phone": "1234567890",
        "address": "123 Test St, Test City",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Insert into database
    result = await db.employers.insert_one(employer_data)
    employer_id = result.inserted_id
    print(f"Created test employer with ID: {employer_id}")
    
    return employer_id

async def create_test_job(employer_id):
    print(f"Creating test job for employer {employer_id}...")
    
    # Check for existing jobs
    existing = await db.jobs.find_one({"employer_id": employer_id})
    if existing:
        print(f"Test job already exists with ID: {existing['_id']}")
        return existing['_id']
    
    # Create job document
    now = datetime.utcnow()
    job_data = {
        "employer_id": employer_id,  # This should be an ObjectId
        "title": "Test Job Position",
        "description": "This is a test job posting for debugging purposes.",
        "location": "Test Location",
        "company_name": "Test Company",
        "skills": ["Python", "MongoDB", "FastAPI"],
        "employment_type": "full-time",
        "is_remote": False,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    
    # Insert into database
    result = await db.jobs.insert_one(job_data)
    job_id = result.inserted_id
    print(f"Created test job with ID: {job_id}")
    
    return job_id

async def inspect_database_state():
    print("\n=== DATABASE INSPECTION ===")
    
    # Check employers collection
    employers = await db.employers.find().to_list(length=10)
    print(f"Found {len(employers)} employers")
    for employer in employers:
        print(f"  Employer: {employer.get('company_name')} (ID: {employer['_id']})")
    
    # Check jobs collection
    jobs = await db.jobs.find().to_list(length=10)
    print(f"Found {len(jobs)} jobs")
    for job in jobs:
        employer_id = job.get('employer_id')
        print(f"  Job: {job.get('title')}")
        print(f"  - Employer ID: {employer_id} (Type: {type(employer_id).__name__})")
        
        # Check if employer exists
        if employer_id:
            employer = await db.employers.find_one({"_id": employer_id})
            if employer:
                print(f"  - Linked to employer: {employer.get('company_name')}")
            else:
                print(f"  - WARNING: No employer found with this ID")

async def test_api_queries():
    print("\n=== TESTING API QUERIES ===")
    
    # Get a sample employer
    employer = await db.employers.find_one({})
    if not employer:
        print("No employers found to test with")
        return
    
    employer_id = employer['_id']
    print(f"Testing with employer ID: {employer_id}")
    
    # Simulate the query used in get_employer_jobs
    query = {"$or": [
        {"employer_id": employer_id},
        {"employer_id": str(employer_id)}
    ]}
    
    jobs = await db.jobs.find(query).to_list(length=10)
    print(f"Query found {len(jobs)} jobs")
    
    # Check direct match
    direct_jobs = await db.jobs.find({"employer_id": employer_id}).to_list(length=10)
    print(f"Direct match found {len(direct_jobs)} jobs")
    
    # Check string match
    string_jobs = await db.jobs.find({"employer_id": str(employer_id)}).to_list(length=10)
    print(f"String match found {len(string_jobs)} jobs")

async def main():
    print("Starting test data creation...")
    
    # Create a test employer if none exists
    employer_id = await create_test_employer()
    
    # Create a test job for this employer
    job_id = await create_test_job(employer_id)
    
    # Inspect the database state
    await inspect_database_state()
    
    # Test API queries
    await test_api_queries()
    
    print("\nTest data creation complete")

if __name__ == "__main__":
    asyncio.run(main()) 