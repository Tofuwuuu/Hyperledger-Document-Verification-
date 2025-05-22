import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get MongoDB connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "alumni_verification")

async def list_users():
    """List all users in the database"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # Get count of users
        count = await db.users.count_documents({})
        logger.info(f"Total users in database: {count}")
        
        # Get all users
        users = await db.users.find().to_list(length=100)
        
        logger.info(f"Retrieved {len(users)} users")
        
        for i, user in enumerate(users):
            user_id = str(user.get('_id', 'Unknown'))
            email = user.get('email', 'Unknown')
            name = user.get('full_name', user.get('name', 'Unknown'))
            is_admin = user.get('is_admin', False)
            has_completed = user.get('has_completed_questionnaire', False)
            
            logger.info(f"User {i+1}: ID: {user_id}, Email: {email}, Name: {name}")
            logger.info(f"  Admin: {is_admin}, Completed Questionnaire: {has_completed}")
            logger.info(f"  Fields: {list(user.keys())}")
            
            # Print abbreviated user data
            user_data = {
                "_id": user_id,
                "email": email,
                "name": name,
                "is_admin": is_admin,
                "has_completed_questionnaire": has_completed
            }
            logger.info(f"  Data: {json.dumps(user_data, indent=2)}")
            logger.info("-" * 50)
        
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
    finally:
        # Close MongoDB connection
        client.close()

if __name__ == "__main__":
    asyncio.run(list_users()) 