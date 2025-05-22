import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get MongoDB connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "alumni_verification")

async def check_questionnaires():
    """Check if questionnaires collection exists and print sample data"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # List all collections
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        # Check if questionnaires collection exists
        if "questionnaires" in collections:
            logger.info("Questionnaires collection exists")
            
            # Count documents
            count = await db.questionnaires.count_documents({})
            logger.info(f"Number of questionnaires: {count}")
            
            # Get sample data
            if count > 0:
                sample = await db.questionnaires.find_one({})
                logger.info(f"Sample questionnaire: {sample}")
            else:
                logger.info("No questionnaires found")
        else:
            logger.info("Questionnaires collection does not exist")
            
            # Create empty collection if it doesn't exist
            logger.info("Creating empty questionnaires collection")
            await db.create_collection("questionnaires")
            logger.info("Questionnaires collection created")
        
    except Exception as e:
        logger.error(f"Error checking questionnaires: {str(e)}")
    finally:
        # Close MongoDB connection
        client.close()

if __name__ == "__main__":
    asyncio.run(check_questionnaires()) 