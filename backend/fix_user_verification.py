import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Database connection string
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")

async def fix_user_verification():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to database: {DATABASE_NAME}")
    
    try:
        # Count before fix
        unverified_before = await db.users.count_documents({"is_verified": False})
        verified_before = await db.users.count_documents({"is_verified": True})
        
        logger.info(f"Before fix - Unverified users: {unverified_before}, Verified users: {verified_before}")
        
        # Fix all users with email testmark213@outlook.com, JohnDoe@gmail.com, and joemarlou.opella@cvsu.edu.ph
        test_emails = [
            "testmark213@outlook.com", 
            "JohnDoe@gmail.com", 
            "joemarlou.opella@cvsu.edu.ph"
        ]
        
        # Apply fixes to each test user
        for email in test_emails:
            user = await db.users.find_one({"email": email})
            if user:
                logger.info(f"User {email} - Current is_verified: {user.get('is_verified')}, Type: {type(user.get('is_verified'))}")
                
                # Update to ensure is_verified is boolean False
                result = await db.users.update_one(
                    {"email": email},
                    {"$set": {"is_verified": False, "verification_pending": True}}
                )
                logger.info(f"Update result for {email}: {result.modified_count} document(s) modified")
            else:
                logger.info(f"User {email} not found")
        
        # Count after fix
        unverified_after = await db.users.count_documents({"is_verified": False})
        verified_after = await db.users.count_documents({"is_verified": True})
        
        logger.info(f"After fix - Unverified users: {unverified_after}, Verified users: {verified_after}")
        
        # Final check of the test users
        for email in test_emails:
            user = await db.users.find_one({"email": email})
            if user:
                logger.info(f"Final check - User {email} - is_verified: {user.get('is_verified')}, Type: {type(user.get('is_verified'))}")
            else:
                logger.info(f"User {email} still not found")
        
    except Exception as e:
        logger.error(f"Error fixing user verification: {e}")
    finally:
        # Close the connection
        client.close()

if __name__ == "__main__":
    asyncio.run(fix_user_verification()) 