import asyncio
import json
from bson import ObjectId, json_util
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

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

async def inspect_database():
    print("\n=== DATABASE INSPECTION ===")
    # Check database collections
    collections = await db.list_collection_names()
    print(f"Collections in database: {collections}")
    
    # Check employer records
    print("\n=== EMPLOYER RECORDS ===")
    employers = await db.employers.find().to_list(length=100)
    print(f"Found {len(employers)} employer records")
    
    for i, employer in enumerate(employers):
        print(f"\nEmployer #{i+1}:")
        print(f"  ID: {employer['_id']} (Type: {type(employer['_id']).__name__})")
        print(f"  Email: {employer.get('email')}")
        print(f"  Company: {employer.get('company_name')}")
    
    # Check job records
    print("\n=== JOB RECORDS ===")
    jobs = await db.jobs.find().to_list(length=100)
    print(f"Found {len(jobs)} job records")
    
    for i, job in enumerate(jobs):
        print(f"\nJob #{i+1}:")
        print(f"  ID: {job['_id']} (Type: {type(job['_id']).__name__})")
        print(f"  Title: {job.get('title')}")
        
        employer_id = job.get('employer_id')
        print(f"  Employer ID: {employer_id} (Type: {type(employer_id).__name__})")
        
        # Check if this employer exists
        if employer_id:
            if isinstance(employer_id, ObjectId):
                employer = await db.employers.find_one({"_id": employer_id})
                print(f"  Employer Exists (ObjectId): {'Yes' if employer else 'No'}")
            else:
                # Try string lookup
                employer = await db.employers.find_one({"_id": employer_id})
                print(f"  Employer Exists (direct): {'Yes' if employer else 'No'}")
                
                # Try ObjectId conversion
                try:
                    obj_id = ObjectId(employer_id)
                    employer = await db.employers.find_one({"_id": obj_id})
                    print(f"  Employer Exists (converted ObjectId): {'Yes' if employer else 'No'}")
                except:
                    print(f"  Cannot convert to ObjectId: {employer_id}")
        else:
            print("  No employer_id found in job record")
    
    # Check tokens collection if it exists
    if 'tokens' in collections:
        print("\n=== TOKEN RECORDS ===")
        tokens = await db.tokens.find().to_list(length=20)
        print(f"Found {len(tokens)} token records")
        for token in tokens[:5]:  # Limit to first 5
            print(json.dumps(token, cls=JSONEncoder, indent=2))

    # Check authentication lookups
    print("\n=== AUTHENTICATION TEST ===")
    # This simulates the get_current_user function behavior
    # We'll take a sample employer ID and try to look it up
    
    if employers:
        sample_employer = employers[0]
        employer_id = sample_employer['_id']
        
        print(f"Testing lookup for employer ID: {employer_id}")
        
        # Test direct lookup
        result = await db.employers.find_one({"_id": employer_id})
        print(f"Direct lookup result: {'Found' if result else 'Not found'}")
        
        # Test string conversion lookup
        str_id = str(employer_id)
        result = await db.employers.find_one({"_id": str_id})
        print(f"String ID lookup result: {'Found' if result else 'Not found'}")
        
        # Test ObjectId conversion lookup
        if isinstance(str_id, str):
            try:
                obj_id = ObjectId(str_id)
                result = await db.employers.find_one({"_id": obj_id})
                print(f"ObjectId conversion lookup result: {'Found' if result else 'Not found'}")
            except:
                print("Cannot convert string ID to ObjectId")
    
    # Debug the job lookup query
    print("\n=== JOB LOOKUP TEST ===")
    if employers:
        sample_employer = employers[0]
        employer_id = sample_employer['_id']
        
        print(f"Testing job lookup for employer ID: {employer_id}")
        
        # Test direct lookup
        count = await db.jobs.count_documents({"employer_id": employer_id})
        print(f"Direct lookup found {count} jobs")
        
        # Test string ID lookup
        str_id = str(employer_id)
        count = await db.jobs.count_documents({"employer_id": str_id})
        print(f"String ID lookup found {count} jobs")
        
        # Test with $or query (what our code uses now)
        or_query = {"$or": [{"employer_id": employer_id}, {"employer_id": str(employer_id)}]}
        count = await db.jobs.count_documents(or_query)
        print(f"$or query found {count} jobs")

async def fix_data_issues():
    """Fix any identified data issues"""
    print("\n=== FIXING DATA ISSUES ===")
    
    # 1. Convert string employer IDs in jobs to ObjectId
    result = await db.jobs.update_many(
        {"employer_id": {"$type": "string"}},
        [{"$set": {"employer_id": {"$toObjectId": "$employer_id"}}}]
    )
    print(f"Fixed {result.modified_count} jobs with string employer_ids")
    
    # 2. Check for any jobs with missing employer_ids
    result = await db.jobs.update_many(
        {"employer_id": {"$exists": False}},
        {"$set": {"status": "invalid"}}
    )
    print(f"Marked {result.modified_count} jobs with missing employer_id as invalid")
    
    # 3. Fix any incorrect employer email fields
    result = await db.employers.update_many(
        {"email": {"$regex": "^\\s+|\\s+$"}}, 
        [{"$set": {"email": {"$trim": {"input": "$email"}}}}]
    )
    print(f"Fixed {result.modified_count} employers with whitespace in email")
    
    print("Data fix complete")

async def main():
    print("Starting database inspection...")
    await inspect_database()
    
    # Ask for confirmation before fixing
    fix_issues = input("\nDo you want to fix any data issues found? (y/n): ")
    if fix_issues.lower() == 'y':
        await fix_data_issues()
    
    print("Script completed")

if __name__ == "__main__":
    asyncio.run(main()) 