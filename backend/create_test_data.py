import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

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

if __name__ == "__main__":
    asyncio.run(create_test_data()) 