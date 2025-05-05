from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

def check_user(email):
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Find the user by email
        user = db.users.find_one({"email": email})
        
        if user:
            print(f"User found with email: {email}")
            print(f"User ID: {user.get('_id')}")
            print(f"Full Name: {user.get('full_name')}")
            print(f"Is Admin: {user.get('is_admin', False)}")
            print(f"Is Active: {user.get('is_active', False)}")
            return True
        else:
            print(f"No user found with email: {email}")
            return False
            
    except Exception as e:
        print(f"Error checking user: {str(e)}")
        return False
    finally:
        # Close the connection
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    # Check for the specific email
    email = "joemarlou.opella@cvsu.edu.ph"
    check_user(email)
    
    # Also list all admin users
    try:
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        print("\nAll admin users in the system:")
        admin_users = db.users.find({"is_admin": True})
        
        count = 0
        for user in admin_users:
            count += 1
            print(f"{count}. {user.get('full_name')} ({user.get('email')})")
            
        if count == 0:
            print("No admin users found.")
            
    except Exception as e:
        print(f"Error listing admin users: {str(e)}")
    finally:
        if 'client' in locals():
            client.close() 