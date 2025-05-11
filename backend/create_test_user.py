import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string from the render.yaml file
MONGODB_URI = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority"

def get_password_hash(password: str) -> str:
    """Create password hash using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

async def create_test_user():
    print("Creating a test user that needs verification...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client['cvsu_alumni']
    
    print(f"Connected to database.")
    
    # Generate test user data
    now = datetime.utcnow()
    from bson import ObjectId
    user_id = str(ObjectId())
    
    # Create user data
    test_user = {
        "_id": user_id,
        "email": f"test.unverified.{now.timestamp()}@cvsu.edu.ph",
        "full_name": "Test Unverified User",
        "hashed_password": get_password_hash("TestPassword123"),
        "is_active": True,
        "is_admin": False,
        "student_id": f"TEST-{int(now.timestamp()) % 10000}",
        "graduation_year": 2023,
        "created_at": now,
        "updated_at": now,
        "is_verified": False,
        "verification_pending": True
    }
    
    # Create alumni profile
    alumni_profile = {
        "_id": str(ObjectId()),
        "user_id": user_id,
        "email": test_user["email"],
        "full_name": test_user["full_name"],
        "student_id": test_user["student_id"],
        "graduation_year": test_user["graduation_year"],
        "created_at": now,
        "updated_at": now,
        "profile_completed": False
    }
    
    # Insert user and profile
    await db.users.insert_one(test_user)
    await db.alumni.insert_one(alumni_profile)
    
    # Create welcome notification
    await db.notifications.insert_one({
        "_id": str(ObjectId()),
        "user_id": user_id,
        "title": "Welcome to CVSU Alumni Portal",
        "message": "Welcome Test User! This is a test account for verification.",
        "is_read": False,
        "type": "welcome",
        "created_at": now
    })
    
    print(f"Test user created successfully:")
    print(f"  Email: {test_user['email']}")
    print(f"  Full Name: {test_user['full_name']}")
    print(f"  Student ID: {test_user['student_id']}")
    print(f"  User ID: {user_id}")
    print(f"  Is Verified: {test_user['is_verified']}")
    print(f"  Verification Pending: {test_user['verification_pending']}")
    print("\nYou can now log in as an admin and verify this user.")
    
    # Close the MongoDB connection
    client.close()
    print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(create_test_user()) 