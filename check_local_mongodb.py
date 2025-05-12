from pymongo import MongoClient
import sys
import os
from dotenv import load_dotenv

load_dotenv()

def test_mongo_connection(uri, name="MongoDB"):
    try:
        # Try to connect to MongoDB
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        
        # Force connection to verify
        client.server_info()
        
        print(f"✅ Successfully connected to {name}!")
        print(f"Available databases: {client.list_database_names()}")
        
        # Check if our database exists
        if "cvsu_alumni" in client.list_database_names():
            db = client["cvsu_alumni"]
            collections = db.list_collection_names()
            print(f"Collections in cvsu_alumni: {collections}")
            
            # Check for users collection
            if "users" in collections:
                users_count = db.users.count_documents({})
                print(f"Found {users_count} users in the database")
        else:
            print("cvsu_alumni database does not exist yet")
            
        return True
    except Exception as e:
        print(f"❌ Failed to connect to {name}: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()
            
if __name__ == "__main__":
    # Test local MongoDB connection
    print("Testing local MongoDB connection (mongodb://localhost:27017/)...")
    local_success = test_mongo_connection("mongodb://localhost:27017/", "Local MongoDB")
    
    # Test Atlas connection if environment variable exists
    atlas_uri = os.getenv("MONGODB_URI")
    if atlas_uri:
        print("\nTesting MongoDB Atlas connection...")
        atlas_success = test_mongo_connection(atlas_uri, "MongoDB Atlas")
    else:
        print("\nMongoDB Atlas URI not found in environment variables")
        atlas_success = False
    
    print("\nConnection Summary:")
    print(f"Local MongoDB: {'✅ Connected' if local_success else '❌ Failed'}")
    print(f"MongoDB Atlas: {'✅ Connected' if atlas_success else '❌ Failed'}")
    
    # Exit with success if at least one connection worked
    if local_success or atlas_success:
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure 