from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Known good bcrypt hash for the password "Password123"
KNOWN_HASH = "$2b$12$8Jt8PCYlVLMn0eQ9.V2CZ.aMX48QKs2lrq6u9WJVMJrIr97xzV0eS"

def fix_admin_password(email):
    try:
        # Connect to MongoDB Atlas
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Find the admin user
        admin_user = db.users.find_one({"email": email})
        
        if not admin_user:
            print(f"Admin user with email {email} not found.")
            return False
        
        # Update the password with a known good hash
        result = db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": KNOWN_HASH}}
        )
        
        if result.modified_count > 0:
            print(f"Password updated successfully for {email}")
            print("New password: Password123")
            return True
        else:
            print("No changes were made.")
            return False
        
    except Exception as e:
        print(f"Error updating admin password: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    # Fix password for both admin users we've created
    emails = ["admin@cvsu.edu.ph", "admin2@cvsu.edu.ph", "opella_admin@cvsu.edu.ph"]
    
    for email in emails:
        print(f"\nAttempting to fix password for {email}:")
        fix_admin_password(email) 