import os
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string from the render.yaml file
MONGODB_URI = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority"

async def check_unverified_users():
    print(f"Connecting to MongoDB...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client['cvsu_alumni']
    
    print(f"Connected to database. Checking users...")
    
    # Count total users
    total_users = await db.users.count_documents({})
    print(f"Total users in database: {total_users}")
    
    # Count and list unverified users
    unverified_users = await db.users.count_documents({"is_verified": False})
    print(f"Unverified users count: {unverified_users}")
    
    if unverified_users > 0:
        print("\nList of unverified users:")
        async for user in db.users.find({"is_verified": False}):
            created_at = user.get("created_at", "Unknown")
            if isinstance(created_at, datetime):
                created_at = created_at.strftime("%Y-%m-%d %H:%M:%S")
            
            print(f"- {user.get('full_name', 'No name')} ({user.get('email', 'No email')})")
            print(f"  ID: {user.get('_id', 'No ID')}")
            print(f"  Created: {created_at}")
            print(f"  Verification pending: {user.get('verification_pending', 'Unknown')}")
            print()
    else:
        print("\nNo unverified users found in the database.")
    
    # Check if any users have verification_pending=True
    pending_users = await db.users.count_documents({"verification_pending": True})
    print(f"Users with verification_pending=True: {pending_users}")
    
    if pending_users > 0:
        print("\nList of users with verification_pending=True:")
        async for user in db.users.find({"verification_pending": True}):
            created_at = user.get("created_at", "Unknown")
            if isinstance(created_at, datetime):
                created_at = created_at.strftime("%Y-%m-%d %H:%M:%S")
            
            print(f"- {user.get('full_name', 'No name')} ({user.get('email', 'No email')})")
            print(f"  ID: {user.get('_id', 'No ID')}")
            print(f"  Created: {created_at}")
            print(f"  Is verified: {user.get('is_verified', 'Unknown')}")
            print()
    else:
        print("\nNo users with verification_pending=True found.")

    # Close the MongoDB connection
    client.close()
    print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(check_unverified_users()) 