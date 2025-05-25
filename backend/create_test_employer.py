import asyncio
import os
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
from passlib.context import CryptContext

# Password hashing utility
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Load environment variables
load_dotenv()

# MongoDB connection details
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DATABASE", "alumni_system")

# Create MongoDB client
client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

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

async def main():
    print("Starting test data creation...")
    
    # Create test employer
    employer_id = await create_test_employer()
    
    # Create test job
    job_id = await create_test_job(employer_id)
    
    # Check the database state
    employers = await db.employers.find().to_list(length=10)
    jobs = await db.jobs.find().to_list(length=10)
    
    print(f"\nDatabase now has {len(employers)} employers and {len(jobs)} jobs")
    
    # Test the query
    query = {"$or": [
        {"employer_id": employer_id}, 
        {"employer_id": str(employer_id)}
    ]}
    
    matching_jobs = await db.jobs.find(query).to_list(length=10)
    print(f"Query found {len(matching_jobs)} jobs")
    
    print("\nTest data creation complete")

if __name__ == "__main__":
    asyncio.run(main()) 