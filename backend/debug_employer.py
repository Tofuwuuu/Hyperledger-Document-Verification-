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

# Helper class for serializing MongoDB objects to JSON
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)

async def diagnose_employer_issue():
    print("=== Diagnosing Employer Issues ===")
    
    # Get all employers
    employers = await db.employers.find().to_list(length=100)
    print(f"Total employers: {len(employers)}")
    
    # Check employer IDs and token types
    for employer in employers:
        print("\n=== Employer Record ===")
        print(f"ID: {employer['_id']} (Type: {type(employer['_id'])})")
        print(f"Email: {employer.get('email')}")
        print(f"Company: {employer.get('company_name')}")
    
    # Check if any jobs exist
    jobs = await db.jobs.find().to_list(length=100)
    print(f"\nTotal jobs: {len(jobs)}")
    
    for job in jobs:
        print("\n=== Job Record ===")
        print(f"Job ID: {job['_id']}")
        print(f"Employer ID: {job.get('employer_id')} (Type: {type(job.get('employer_id'))})")
        print(f"Title: {job.get('title')}")
        print(f"Status: {job.get('status')}")
        
        # Try to find the employer for this job
        employer_id = job.get('employer_id')
        if employer_id:
            try:
                # Try as ObjectId
                if isinstance(employer_id, str):
                    try:
                        employer = await db.employers.find_one({"_id": ObjectId(employer_id)})
                        if employer:
                            print(f"✅ Found employer with ObjectId: {employer.get('email')}")
                        else:
                            print(f"❌ No employer found with ObjectId conversion")
                    except Exception as e:
                        print(f"❌ Error trying ObjectId conversion: {str(e)}")
                        
                    # Try as plain string
                    employer = await db.employers.find_one({"_id": employer_id})
                    if employer:
                        print(f"✅ Found employer with string ID: {employer.get('email')}")
                    else:
                        print(f"❌ No employer found with string ID")
                else:
                    # If it's already an ObjectId
                    employer = await db.employers.find_one({"_id": employer_id})
                    if employer:
                        print(f"✅ Found employer with direct ID: {employer.get('email')}")
                    else:
                        print(f"❌ No employer found with direct ID")
            except Exception as e:
                print(f"❌ Error looking up employer: {str(e)}")

async def fix_employer_issues():
    print("\n=== Fixing Employer Issues ===")
    
    # 1. Check if we need to convert employer IDs in jobs from strings to ObjectIds
    string_id_jobs = await db.jobs.find({"employer_id": {"$type": "string"}}).to_list(length=100)
    print(f"Found {len(string_id_jobs)} jobs with string employer IDs")
    
    for job in string_id_jobs:
        employer_id = job.get('employer_id')
        try:
            # Try to convert to ObjectId
            obj_id = ObjectId(employer_id)
            # Check if the employer exists with this ID
            employer = await db.employers.find_one({"_id": obj_id})
            if employer:
                print(f"Updating job {job['_id']} employer_id from string to ObjectId")
                await db.jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"employer_id": obj_id}}
                )
                print(f"✅ Updated job employer_id for {job.get('title')}")
            else:
                print(f"❌ Could not find employer with ID {employer_id}")
        except Exception as e:
            print(f"❌ Error converting employer_id for job {job['_id']}: {str(e)}")
    
    # 2. Check for any corrupted employer documents
    print("\nChecking for corrupted employer documents...")
    employers = await db.employers.find().to_list(length=100)
    
    for employer in employers:
        # Check if the _id field is valid
        if not isinstance(employer['_id'], ObjectId):
            print(f"⚠️ Employer {employer.get('email')} has non-ObjectId _id: {employer['_id']}")
            
            try:
                # Try to convert _id to ObjectId
                obj_id = ObjectId(str(employer['_id']))
                print(f"Will attempt to fix employer {employer.get('email')}")
                
                # Create new document with correct ObjectId
                fixed_employer = {**employer}
                fixed_employer['_id'] = obj_id
                
                # Insert new document and delete old one
                await db.employers.insert_one(fixed_employer)
                await db.employers.delete_one({"_id": employer['_id']})
                print(f"✅ Fixed employer {employer.get('email')}")
            except Exception as e:
                print(f"❌ Error fixing employer {employer.get('email')}: {str(e)}")

async def main():
    print("Starting diagnosis...")
    await diagnose_employer_issue()
    
    # Ask before fixing
    response = input("\nDo you want to attempt to fix the issues? (y/n): ")
    if response.lower() == 'y':
        await fix_employer_issues()
        print("\nFix attempt completed. Please check the output for success or failure messages.")
    else:
        print("\nNo fixes applied.")

if __name__ == "__main__":
    asyncio.run(main())