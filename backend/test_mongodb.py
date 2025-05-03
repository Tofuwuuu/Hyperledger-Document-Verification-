from pymongo import MongoClient
import sys

def test_mongo_connection():
    try:
        # Try to connect to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        
        # Force connection to verify
        client.server_info()
        
        print("Successfully connected to MongoDB!")
        print("Available databases:", client.list_database_names())
        
        # Check if our database exists
        if "cvsu_alumni" in client.list_database_names():
            db = client["cvsu_alumni"]
            collections = db.list_collection_names()
            print("Collections in cvsu_alumni:", collections)
            
            # Check for users collection
            if "users" in collections:
                users_count = db.users.count_documents({})
                print(f"Found {users_count} users in the database")
        else:
            print("cvsu_alumni database does not exist yet")
            
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()
            
if __name__ == "__main__":
    if test_mongo_connection():
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure 