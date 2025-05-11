import asyncio
import os
import json
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string from the render.yaml file
MONGODB_URI = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority"

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def fetch_unverified_users():
    print("Directly fetching unverified users from the database...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client['cvsu_alumni']
    
    print(f"Connected to database. Checking unverified users...")
    
    # Get database statistics
    total_users = await db.users.count_documents({})
    unverified_users = await db.users.count_documents({"is_verified": False})
    verification_pending = await db.users.count_documents({"verification_pending": True})
    
    print(f"Database Statistics:")
    print(f"  Total Users: {total_users}")
    print(f"  Unverified Users: {unverified_users}")
    print(f"  Users with Verification Pending: {verification_pending}")
    print("")
    
    if unverified_users == 0:
        print("No unverified users found in the database.")
        print("Consider creating a test user with the create_test_user.py script.")
    else:
        print(f"Found {unverified_users} unverified users:")
        
        # Fetch unverified users with a projection to limit fields
        cursor = db.users.find(
            {"is_verified": False},
            {
                "_id": 1,
                "email": 1,
                "full_name": 1,
                "student_id": 1,
                "created_at": 1,
                "verification_pending": 1
            }
        )
        
        unverified_list = []
        async for user in cursor:
            unverified_list.append(user)
            
        # Format and print user details
        for i, user in enumerate(unverified_list):
            print(f"User {i+1}:")
            print(f"  ID: {user.get('_id')}")
            print(f"  Email: {user.get('email')}")
            print(f"  Name: {user.get('full_name')}")
            print(f"  Student ID: {user.get('student_id', 'Not provided')}")
            created_at = user.get('created_at')
            if created_at:
                created_at_str = created_at.strftime("%Y-%m-%d %H:%M:%S")
            else:
                created_at_str = "Unknown"
            print(f"  Created: {created_at_str}")
            print(f"  Verification Pending: {user.get('verification_pending', False)}")
            print("")
        
        # Export unverified users to a JSON file for reference
        output_file = "unverified_users.json"
        with open(output_file, "w") as f:
            json.dump(unverified_list, f, cls=MongoJSONEncoder, indent=2)
        
        print(f"Exported unverified users to {output_file}")
        print("")
        print("Admin Verification Instructions:")
        print("1. Log in to the admin dashboard")
        print("2. Navigate to User Verification page")
        print("3. You should see the unverified users listed")
        print("4. If users are not showing in the admin interface, check application logs for errors")
    
    # Close the MongoDB connection
    client.close()
    print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(fetch_unverified_users()) 