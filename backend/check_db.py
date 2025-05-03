import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pymongo import MongoClient
import json
from bson import ObjectId

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# MongoDB connection
client = MongoClient('mongodb://localhost:27017')
db = client.cvsu_alumni

# Custom JSON encoder to handle ObjectId
class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super(MongoEncoder, self).default(obj)

async def check_database():
    """Check MongoDB connection and collections"""
    print(f"Checking MongoDB connection to: {MONGODB_URL}")
    print(f"Database name: {MONGODB_DB}")
    
    try:
        # Create client
        client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000
        )
        
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
        
        # Get database
        db = client[MONGODB_DB]
        
        # List collections
        collections = await db.list_collection_names()
        print(f"\nCollections in {MONGODB_DB}:")
        for collection in collections:
            print(f"  - {collection}")
        
        # Check document_requests collection
        if 'document_requests' in collections:
            print("\n✅ document_requests collection exists")
            
            # Count documents
            count = await db.document_requests.count_documents({})
            print(f"   Documents in collection: {count}")
            
            # Get sample document
            if count > 0:
                sample = await db.document_requests.find_one({})
                print("\nSample document:")
                print(f"  _id: {sample.get('_id')}")
                print(f"  alumni_id: {sample.get('alumni_id')}")
                print(f"  document_type: {sample.get('document_type')}")
                print(f"  status: {sample.get('status')}")
        else:
            print("\n❌ document_requests collection does not exist!")
            print("Creating collection...")
            await db.create_collection("document_requests")
            print("✅ document_requests collection created")
            
            # Create indexes
            await db.document_requests.create_index("alumni_id")
            await db.document_requests.create_index("status")
            await db.document_requests.create_index("document_type")
            await db.document_requests.create_index("created_at")
            print("✅ Created indexes for document_requests collection")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        
    finally:
        # Close client
        if 'client' in locals():
            client.close()
            print("\nClosed MongoDB connection")

# Check alumni collection
print("ALUMNI RECORDS:")
alumni_count = db.alumni.count_documents({})
print(f"Total alumni records: {alumni_count}")

if alumni_count > 0:
    alumni_samples = list(db.alumni.find({}).limit(3))
    print("Sample alumni records:")
    for alumni in alumni_samples:
        print(json.dumps(alumni, cls=MongoEncoder, indent=2))

# Check users collection
print("\nUSER RECORDS:")
user_count = db.users.count_documents({})
print(f"Total user records: {user_count}")

if user_count > 0:
    user_samples = list(db.users.find({}).limit(3))
    print("Sample user records:")
    for user in user_samples:
        print(json.dumps(user, cls=MongoEncoder, indent=2))

# Check document_requests collection
print("\nDOCUMENT REQUEST RECORDS:")
req_count = db.document_requests.count_documents({})
print(f"Total document request records: {req_count}")

if req_count > 0:
    req_samples = list(db.document_requests.find({}).limit(3))
    print("Sample document request records:")
    for req in req_samples:
        print(json.dumps(req, cls=MongoEncoder, indent=2))

if __name__ == "__main__":
    print("=== MongoDB Connection Diagnostic Tool ===\n")
    asyncio.run(check_database()) 