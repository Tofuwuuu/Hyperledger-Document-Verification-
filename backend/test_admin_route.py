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

async def test_exit_interviews_query():
    """Test the logic for getting exit interviews"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # List all collections
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        # Try the same query we're using in the route
        logger.info("Attempting to query users with completed questionnaires")
        users_with_questionnaires = await db.users.find(
            {"has_completed_questionnaire": True, "questionnaire": {"$exists": True}}
        ).to_list(length=1000)
        
        logger.info(f"Found {len(users_with_questionnaires)} users with questionnaires")
        
        # Test one user to check structure
        if users_with_questionnaires:
            user = users_with_questionnaires[0]
            logger.info(f"Sample user ID: {user.get('_id')}")
            logger.info(f"has_completed_questionnaire: {user.get('has_completed_questionnaire')}")
            logger.info(f"User has 'questionnaire' field: {'questionnaire' in user}")
            
            # Check the questionnaire field specifically
            if 'questionnaire' in user:
                questionnaire = user['questionnaire']
                logger.info(f"Questionnaire type: {type(questionnaire)}")
                logger.info(f"Questionnaire value: {questionnaire}")
        
            # Extract and format questionnaires as in the route
            questionnaires = []
            for user in users_with_questionnaires:
                try:
                    if "questionnaire" in user and user["questionnaire"]:
                        # Create a new object with questionnaire data and some user info
                        questionnaire_data = user["questionnaire"]
                        
                        # Add user information - converting ObjectId to string
                        questionnaire_data["_id"] = str(user["_id"])
                        questionnaire_data["email"] = user.get("email", "")
                        questionnaire_data["student_id"] = user.get("student_id", "")
                        questionnaire_data["full_name"] = user.get("full_name", "")
                        
                        # Convert any ObjectId to string
                        for key, value in questionnaire_data.items():
                            if hasattr(value, "__str__"):  # Check if it can be converted to string
                                questionnaire_data[key] = str(value)
                        
                        questionnaires.append(questionnaire_data)
                except Exception as e:
                    logger.error(f"Error processing user {user.get('_id')}: {str(e)}")
                    logger.error(traceback.format_exc())
            
            # Try to JSON serialize the result to check if that's the issue
            try:
                json_result = json.dumps(questionnaires)
                logger.info("Successfully serialized result to JSON")
            except Exception as e:
                logger.error(f"Error serializing to JSON: {str(e)}")
                logger.error(traceback.format_exc())
                
                # Try to identify problem objects
                for i, q in enumerate(questionnaires):
                    try:
                        json.dumps(q)
                    except Exception as e:
                        logger.error(f"Problem with questionnaire {i}: {str(e)}")
                        # Check each field
                        for key, value in q.items():
                            try:
                                json.dumps({key: value})
                            except Exception as e:
                                logger.error(f"Problem field: {key}, value type: {type(value)}")
        
    except Exception as e:
        logger.error(f"Error testing exit interviews query: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Close MongoDB connection
        client.close()

if __name__ == "__main__":
    asyncio.run(test_exit_interviews_query()) 