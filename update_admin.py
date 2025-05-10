import os
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Production MongoDB URL (found in backend/create_admin.py)
PROD_MONGODB_URL = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0"
MONGODB_DB = "cvsu_alumni"

# Ask for confirmation before proceeding
print("This script will modify the PRODUCTION database!")
print(f"Database URL: {PROD_MONGODB_URL.split('@')[1].split('/')[0]}")
confirm = input("Do you want to continue? (y/n): ")
if confirm.lower() != 'y':
    print("Operation cancelled.")
    sys.exit(0)

async def update_user_to_admin():
    # Connect to MongoDB production database
    print(f"Connecting to MongoDB production database...")
    client = AsyncIOMotorClient(PROD_MONGODB_URL)
    db = client[MONGODB_DB]
    
    try:
        # Test the connection
        await client.admin.command('ping')
        print("Connection to production database successful!")
    except Exception as e:
        print(f"Error connecting to production database: {str(e)}")
        return
    
    # Search for user by email
    print("Searching for user by email...")
    user = await db.users.find_one({"email": "joemarlou.opella@cvsu.edu.ph"})
    if not user:
        print("User not found in production database!")
        return
    
    user_id = user['_id']
    print(f"Found user with ID: {user_id}")
    
    # Update the user to make them an admin
    print(f"Updating user to admin status...")
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"is_admin": True, "updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count > 0:
        print("SUCCESS: User was updated to admin status!")
    else:
        print("No changes made. User might already be an admin.")
    
    # Verify the update
    updated_user = await db.users.find_one({"_id": user_id})
    print(f"User details after update:")
    print(f"Name: {updated_user.get('full_name')}")
    print(f"Email: {updated_user.get('email')}")
    print(f"Admin status: {updated_user.get('is_admin')}")
    
    # Close the connection
    client.close()

# Run the async function
if __name__ == "__main__":
    asyncio.run(update_user_to_admin()) 