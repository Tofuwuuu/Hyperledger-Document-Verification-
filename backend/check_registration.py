import asyncio
import logging
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test user data
test_user = {
    "email": "test_user@example.com",
    "full_name": "Test User",
    "password": "TestPassword123",
    "student_id": "12345678",
    "graduation_year": 2022
}

async def test_register():
    """Test user registration function"""
    # Connect to MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017/')
    db = client['cvsu_alumni']
    
    # Check if the user already exists
    existing_user = await db.users.find_one({"email": test_user["email"]})
    if existing_user:
        logger.info(f"User {test_user['email']} already exists in the database")
        return
    
    try:
        # Create new user document
        user_id = str(ObjectId())
        now = datetime.utcnow()
        
        # In a real app you would hash the password, but for testing we'll skip that
        new_user = {
            "_id": user_id,
            "email": test_user["email"],
            "full_name": test_user["full_name"],
            "hashed_password": f"test_password_hash_for_{test_user['password']}",
            "is_active": True,
            "is_admin": False,
            "student_id": test_user["student_id"],
            "graduation_year": test_user["graduation_year"],
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
        
        # Create a notification
        notification = {
            "_id": str(ObjectId()),
            "user_id": user_id,
            "title": "Welcome to CVSU Alumni Portal",
            "message": f"Welcome {test_user['full_name']}! Please complete your profile to get verified.",
            "is_read": False,
            "type": "welcome",
            "created_at": now
        }
        
        # Insert documents to database
        logger.info("Attempting to insert user document...")
        result_user = await db.users.insert_one(new_user)
        logger.info(f"User document inserted with ID: {result_user.inserted_id}")
        
        logger.info("Attempting to insert alumni profile...")
        result_alumni = await db.alumni.insert_one(alumni_profile)
        logger.info(f"Alumni profile inserted with ID: {result_alumni.inserted_id}")
        
        logger.info("Attempting to insert notification...")
        result_notif = await db.notifications.insert_one(notification)
        logger.info(f"Notification inserted with ID: {result_notif.inserted_id}")
        
        logger.info("All documents inserted successfully!")
        
        # Verify that the user was actually inserted
        synch_client = MongoClient('mongodb://localhost:27017/')
        synch_db = synch_client['cvsu_alumni']
        check_user = synch_db.users.find_one({"email": test_user["email"]})
        logger.info(f"User found after insert: {check_user is not None}")
        
        return True
    except Exception as e:
        logger.error(f"Error during test registration: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting registration test...")
    result = asyncio.run(test_register())
    logger.info(f"Registration test completed with result: {result}")
    
    # Double-check if the test user exists in the database
    client = MongoClient('mongodb://localhost:27017/')
    db = client['cvsu_alumni']
    user = db.users.find_one({"email": test_user["email"]})
    logger.info(f"Test user exists in database: {user is not None}")
    
    # Check if MongoDB is writable
    try:
        test_collection = db.test_collection
        test_doc = {"test": "write_test", "timestamp": datetime.utcnow()}
        result = test_collection.insert_one(test_doc)
        logger.info(f"MongoDB write test successful with ID: {result.inserted_id}")
        # Clean up test document
        test_collection.delete_one({"_id": result.inserted_id})
    except Exception as e:
        logger.error(f"MongoDB write test failed: {str(e)}") 