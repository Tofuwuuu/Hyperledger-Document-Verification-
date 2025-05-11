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
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")  # Use default if not set

async def check_database():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to database: {DATABASE_NAME}")
    
    try:
        # Count all users
        total_users = await db.users.count_documents({})
        logger.info(f"Total users in database: {total_users}")
        
        # Check specific unverified users
        unverified_count = await db.users.count_documents({"is_verified": False})
        logger.info(f"Users with is_verified=False: {unverified_count}")
        
        # Check users with verification_pending=True
        pending_count = await db.users.count_documents({"verification_pending": True})
        logger.info(f"Users with verification_pending=True: {pending_count}")
        
        # Check combined query (what our API uses)
        or_query = {
            "$or": [
                {"is_verified": False},
                {"is_verified": {"$exists": False}},
                {"is_verified": None},
                {"verification_pending": True}
            ]
        }
        or_count = await db.users.count_documents(or_query)
        logger.info(f"Users matching $or query: {or_count}")
        
        # List some sample unverified users
        logger.info("Sample unverified users:")
        cursor = db.users.find({"is_verified": False}).limit(5)
        async for user in cursor:
            logger.info(f"ID: {user['_id']}, Email: {user.get('email')}, Name: {user.get('full_name')}")
            
        # Check specific user 
        test_user = await db.users.find_one({"email": "testmark213@outlook.com"})
        if test_user:
            logger.info(f"Test user: {test_user.get('email')}")
            logger.info(f"is_verified: {test_user.get('is_verified')}")
            logger.info(f"verification_pending: {test_user.get('verification_pending')}")
        else:
            logger.info("Test user not found")
            
    except Exception as e:
        logger.error(f"Error checking database: {e}")
    finally:
        # Close the connection
        client.close()

if __name__ == "__main__":
    asyncio.run(check_database()) 