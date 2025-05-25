import asyncio
import os
import json
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

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)

async def inspect_collections():
    """Inspect database collections"""
    collections = await db.list_collection_names()
    print(f"Collections in database: {collections}")
    return collections

async def fix_employer_with_credentials():
    """Create or update a test employer with proper credentials"""
    email = "test@employer.com"
    password = "password123"
    
    # Check if employer exists
    employer = await db.employers.find_one({"email": email})
    
    if employer:
        print(f"Found existing employer: {employer.get('company_name')} (ID: {employer['_id']})")
        
        # Update password to known value
        hashed_password = pwd_context.hash(password)
        await db.employers.update_one(
            {"_id": employer["_id"]},
            {"$set": {"hashed_password": hashed_password}}
        )
        print(f"Updated employer password")
        
        return employer["_id"]
    else:
        # Create new employer
        employer_data = {
            "email": email,
            "hashed_password": pwd_context.hash(password),
            "company_name": "Test Employer Company",
            "industry": "Technology",
            "contact_person": "Test User",
            "phone": "1234567890",
            "address": "123 Test St.",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True
        }
        
        result = await db.employers.insert_one(employer_data)
        employer_id = result.inserted_id
        print(f"Created new employer with ID: {employer_id}")
        
        return employer_id

async def fix_all_jobs(employer_id):
    """Fix all jobs to use the proper employer ID"""
    # Convert string employer IDs to ObjectId
    string_id_jobs = await db.jobs.find({"employer_id": {"$type": "string"}}).to_list(length=None)
    print(f"Found {len(string_id_jobs)} jobs with string employer IDs")
    
    fixed_count = 0
    for job in string_id_jobs:
        try:
            # Try to convert string to ObjectId
            obj_id = ObjectId(job["employer_id"])
            await db.jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"employer_id": obj_id}}
            )
            fixed_count += 1
        except Exception as e:
            print(f"Error fixing job {job['_id']}: {e}")
    
    print(f"Fixed {fixed_count} jobs with string employer IDs")
    
    # Create a test job for our employer if none exists
    employer_jobs = await db.jobs.find({"employer_id": employer_id}).to_list(length=None)
    if not employer_jobs:
        now = datetime.utcnow()
        job_data = {
            "employer_id": employer_id,
            "title": "Fixed Test Job",
            "description": "This job was created during the employer ID fix process.",
            "location": "Test Location",
            "company_name": "Test Employer Company",
            "skills": ["Python", "MongoDB", "FastAPI"],
            "employment_type": "full-time",
            "is_remote": False,
            "status": "active",
            "created_at": now,
            "updated_at": now
        }
        
        result = await db.jobs.insert_one(job_data)
        print(f"Created test job with ID: {result.inserted_id}")

async def main():
    try:
        print("Starting employer and job fixes...")
        
        # Check collections
        collections = await inspect_collections()
        
        # Fix employer with credentials
        employer_id = await fix_employer_with_credentials()
        
        # Fix all jobs
        await fix_all_jobs(employer_id)
        
        print("\nFix complete. You can now login with:")
        print("  Email: test@employer.com")
        print("  Password: password123")
        
    except Exception as e:
        print(f"Error during fix process: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 