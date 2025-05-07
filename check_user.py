from pymongo import MongoClient
import json
from bson import ObjectId
from datetime import datetime

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def check_user(email_pattern="test"):
    """
    Check if a user with the specified email pattern exists in the database
    """
    try:
        # Connect to MongoDB Atlas (Production DB)
        mongodb_url = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0"
        db_name = "cvsu_alumni"
        
        print(f"Connecting to MongoDB Atlas database: {db_name}...")
        client = MongoClient(mongodb_url, serverSelectionTimeoutMS=5000)
        
        # Force connection to verify
        client.server_info()
        print("Successfully connected to MongoDB Atlas!")
        
        # Get database
        db = client[db_name]
        
        # Check if the users collection exists
        if "users" not in db.list_collection_names():
            print(f"The 'users' collection does not exist in the {db_name} database.")
            return
        
        # Find users with email containing the pattern (case insensitive)
        import re
        pattern = re.compile(f".*{email_pattern}.*", re.IGNORECASE)
        users = list(db.users.find({"email": {"$regex": pattern}}))
        
        if users:
            print(f"Found {len(users)} users with email containing '{email_pattern}':")
            for idx, user in enumerate(users, 1):
                print(f"{idx}. {user.get('email', 'No email')} - Full name: {user.get('full_name', 'Unknown')}")
        else:
            print(f"No users found with email containing '{email_pattern}'")
            
        # List a few recent users to help with debugging
        print("\nMost recent users in the database:")
        recent_users = list(db.users.find().sort("created_at", -1).limit(5))
        for idx, user in enumerate(recent_users, 1):
            print(f"{idx}. {user.get('email', 'No email')} - Full name: {user.get('full_name', 'Unknown')}")
            
    except Exception as e:
        print(f"Failed to check for user: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    pattern = input("Enter email pattern to search (default: test): ").strip()
    if not pattern:
        pattern = "test"
    check_user(pattern) 