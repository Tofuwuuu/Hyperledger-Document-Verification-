import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cvsu_alumni")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Check for common cloud provider environment variables
cloud_mongodb_url = os.getenv("DATABASE_URL")
if cloud_mongodb_url:
    print("Using DATABASE_URL from environment")
    MONGODB_URL = cloud_mongodb_url

mongodb_atlas_uri = os.getenv("MONGODB_URI") 
if mongodb_atlas_uri:
    print("Using MONGODB_URI from environment")
    MONGODB_URL = mongodb_atlas_uri

async def update_user_to_admin():
    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB]
    
    # User ID to update - convert string to ObjectId
    user_id_str = "681ec28749c2b2c3dd0f500c"
    try:
        user_id = ObjectId(user_id_str)
        print(f"Converted ID to ObjectId: {user_id}")
    except Exception as e:
        print(f"Error converting to ObjectId: {e}")
        return
    
    # First check if user exists
    user = await db.users.find_one({"_id": user_id})
    if not user:
        print(f"No user found with ID: {user_id}")
        print("Searching for user by email instead...")
        user = await db.users.find_one({"email": "joemarlou.opella@cvsu.edu.ph"})
        if user:
            print(f"Found user by email. User ID: {user['_id']}")
            user_id = user['_id']
        else:
            print("User not found by email either.")
            return
    
    # Update the user to make them an admin
    print(f"Updating user with ID: {user_id}")
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"is_admin": True, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count > 0:
        if result.modified_count > 0:
            print(f"Successfully updated user to admin status!")
        else:
            print(f"User found but no changes were made (might already be admin)")
    else:
        print(f"No user found with ID: {user_id}")
    
    # Verify the update
    user = await db.users.find_one({"_id": user_id})
    if user:
        print(f"User details after update:")
        print(f"Name: {user.get('full_name')}")
        print(f"Email: {user.get('email')}")
        print(f"Admin status: {user.get('is_admin')}")
    
    # Close the connection
    client.close()

# Run the async function
if __name__ == "__main__":
    asyncio.run(update_user_to_admin()) 