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

async def check_questionnaires_collection():
    """Check the contents of the questionnaires collection"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # Check if questionnaires collection exists
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        if "questionnaires" in collections:
            logger.info("Questionnaires collection exists")
            
            # Count documents
            count = await db.questionnaires.count_documents({})
            logger.info(f"Number of questionnaires: {count}")
            
            # Get sample data
            if count > 0:
                questionnaires = await db.questionnaires.find().to_list(length=10)
                logger.info(f"Found {len(questionnaires)} questionnaires")
                
                # Print each questionnaire
                for i, q in enumerate(questionnaires):
                    q_id = str(q.get('_id', 'Unknown'))
                    logger.info(f"Questionnaire {i+1} (ID: {q_id}):")
                    
                    # Convert ObjectId to string for display
                    for key, value in q.items():
                        if key == '_id' or 'id' in key.lower():
                            q[key] = str(value)
                    
                    # Pretty print the questionnaire
                    logger.info(json.dumps(q, indent=2, default=str))
                    
                    # Check if there's a user_id and try to find the corresponding user
                    if 'user_id' in q:
                        user_id = q['user_id']
                        user = await db.users.find_one({"_id": user_id})
                        
                        if user:
                            logger.info(f"Found matching user: {user.get('email', 'Unknown')} (ID: {str(user.get('_id', 'Unknown'))})")
                        else:
                            logger.info(f"No matching user found for ID: {str(user_id)}")
            else:
                logger.info("Questionnaires collection is empty")
        else:
            logger.info("Questionnaires collection does not exist")
        
    except Exception as e:
        logger.error(f"Error checking questionnaires collection: {str(e)}")
    finally:
        # Close MongoDB connection
        client.close()

if __name__ == "__main__":
    asyncio.run(check_questionnaires_collection()) 