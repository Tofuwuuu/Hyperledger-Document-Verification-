import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import requests
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get MongoDB connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "alumni_verification")

async def test_exit_interviews_query():
    """Test the logic for getting exit interviews"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # Test if users collection exists
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        if "users" in collections:
            # Check if any users have completed questionnaires
            users_with_questionnaires = await db.users.find(
                {"has_completed_questionnaire": True, "questionnaire": {"$exists": True}}
            ).to_list(length=10)
            
            logger.info(f"Found {len(users_with_questionnaires)} users with questionnaires")
            
            # Check the structure of the first user with a questionnaire
            if users_with_questionnaires:
                user = users_with_questionnaires[0]
                logger.info(f"Sample user ID: {user.get('_id')}")
                logger.info(f"has_completed_questionnaire: {user.get('has_completed_questionnaire')}")
                logger.info(f"User has 'questionnaire' field: {'questionnaire' in user}")
                
                # Check the questionnaire field content
                if 'questionnaire' in user:
                    questionnaire = user['questionnaire']
                    logger.info(f"Questionnaire type: {type(questionnaire)}")
                    logger.info(f"Questionnaire fields: {list(questionnaire.keys())}")
            else:
                logger.warning("No users with completed questionnaires found")
        else:
            logger.warning("Users collection does not exist")
            
    except Exception as e:
        logger.error(f"Error testing exit interviews query: {str(e)}")
    finally:
        # Close MongoDB connection
        client.close()

def test_api_endpoint():
    """Test the API endpoint directly"""
    # You'll need a valid admin token to test this endpoint
    token = input("Enter an admin token: ")
    
    try:
        response = requests.get(
            "http://localhost:8000/api/v1/admin/exit-interviews",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        logger.info(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully retrieved {len(data)} exit interviews")
            
            # Show sample if available
            if data:
                logger.info(f"Sample interview fields: {list(data[0].keys())}")
        else:
            logger.error(f"Failed to retrieve exit interviews: {response.text}")
            
    except Exception as e:
        logger.error(f"Error testing API endpoint: {str(e)}")

if __name__ == "__main__":
    print("Testing exit interviews database query...")
    asyncio.run(test_exit_interviews_query())
    
    print("\nDo you want to test the API endpoint directly? (y/n)")
    choice = input().lower().strip()
    if choice == 'y':
        test_api_endpoint() 