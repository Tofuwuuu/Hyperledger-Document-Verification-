import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import json
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get MongoDB connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "alumni_verification")

async def check_user_questionnaires():
    """Check for questionnaire data in the users collection"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # Check users with has_completed_questionnaire
        logger.info("Checking users with has_completed_questionnaire flag")
        users_with_flag = await db.users.find(
            {"has_completed_questionnaire": True}
        ).to_list(length=10)
        
        logger.info(f"Found {len(users_with_flag)} users with has_completed_questionnaire=True")
        
        for user in users_with_flag:
            user_id = str(user.get('_id', 'Unknown'))
            email = user.get('email', 'Unknown')
            logger.info(f"User ID: {user_id}, Email: {email}")
            logger.info(f"Fields in user document: {list(user.keys())}")
            
            # Check if questionnaire field exists
            if 'questionnaire' in user:
                logger.info(f"User has questionnaire field")
                logger.info(f"Questionnaire type: {type(user['questionnaire'])}")
                
                # Print questionnaire data
                questionnaire = user['questionnaire']
                # Convert ObjectId to string for display
                if isinstance(questionnaire, dict):
                    for key, value in questionnaire.items():
                        if hasattr(value, '__str__'):
                            questionnaire[key] = str(value)
                    
                    logger.info(f"Questionnaire data: {json.dumps(questionnaire, indent=2, default=str)}")
                else:
                    logger.info(f"Questionnaire value: {questionnaire}")
            else:
                logger.info(f"User does not have questionnaire field")
                
            logger.info("-" * 50)
            
        # Also check if any users have embedded questionnaire field
        logger.info("Checking users with questionnaire field")
        users_with_questionnaire = await db.users.find(
            {"questionnaire": {"$exists": True}}
        ).to_list(length=10)
        
        logger.info(f"Found {len(users_with_questionnaire)} users with questionnaire field")
        
        # Try direct approach by user ID if available
        if not users_with_flag and not users_with_questionnaire:
            logger.info("Checking specific user by ID from the example")
            user = await db.users.find_one({"_id": ObjectId("6804c06543846509ed9ba2ed")})
            
            if user:
                logger.info(f"Found user: {user.get('email', 'Unknown')}")
                logger.info(f"has_completed_questionnaire: {user.get('has_completed_questionnaire')}")
                logger.info(f"Fields in user document: {list(user.keys())}")
                
                if 'questionnaire' in user:
                    logger.info(f"User has questionnaire field")
                    logger.info(f"Questionnaire type: {type(user['questionnaire'])}")
                    
                    # Print questionnaire data
                    questionnaire = user['questionnaire']
                    logger.info(f"Questionnaire data: {json.dumps(questionnaire, indent=2, default=str)}")
                else:
                    logger.info(f"User does not have questionnaire field")
            else:
                logger.info("Specific user not found")
    
    except Exception as e:
        logger.error(f"Error checking user questionnaires: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Close MongoDB connection
        client.close()

if __name__ == "__main__":
    # Import here to avoid issues
    from bson import ObjectId
    asyncio.run(check_user_questionnaires()) 