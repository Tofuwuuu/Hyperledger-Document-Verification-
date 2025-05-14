import json
import os
import asyncio
from pymongo import MongoClient
from bson import ObjectId, Timestamp
from datetime import datetime

# Custom JSON encoder to handle MongoDB specific types
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Timestamp):
            return obj.time
        return json.JSONEncoder.default(self, obj)

async def backup_alumni_collection():
    # MongoDB connection details
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "cvsu_alumni")
    
    print(f"Connecting to MongoDB: {mongo_uri}")
    
    try:
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client[db_name]
        
        # Get the alumni collection
        alumni_collection = db["alumni"]
        
        # Count documents
        doc_count = alumni_collection.count_documents({})
        print(f"Found {doc_count} alumni documents")
        
        # Fetch all alumni documents
        alumni_docs = list(alumni_collection.find({}))
        
        # Create backup directory if it doesn't exist
        os.makedirs("backup", exist_ok=True)
        
        # Generate timestamp for filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup/alumni_backup_{timestamp}.json"
        
        # Save to JSON file
        with open(backup_filename, 'w') as f:
            json.dump(alumni_docs, f, cls=MongoJSONEncoder, indent=2)
        
        print(f"Successfully backed up {len(alumni_docs)} alumni documents to {backup_filename}")
        
    except Exception as e:
        print(f"Error backing up alumni collection: {str(e)}")
    finally:
        client.close()
        print("MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(backup_alumni_collection()) 