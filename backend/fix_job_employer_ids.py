import asyncio
import motor.motor_asyncio
from bson import ObjectId
import logging
import os
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("fix_employer_ids.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection URL
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")

# Connect to MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

async def fix_employer_ids():
    """
    Ensure all employer_id fields in jobs collection are stored as strings
    for consistent querying and comparison.
    """
    logger.info("Starting to fix employer_id format in jobs collection...")
    
    # Get all jobs
    cursor = db.jobs.find({})
    updated_count = 0
    error_count = 0
    
    async for job in cursor:
        try:
            job_id = job["_id"]
            employer_id = job.get("employer_id")
            
            # Only process if employer_id exists and is not already a string
            if employer_id and not isinstance(employer_id, str):
                # Convert to string
                employer_id_str = str(employer_id)
                logger.info(f"Job {job_id}: Converting employer_id from {type(employer_id)} to string: {employer_id_str}")
                
                # Update the document
                result = await db.jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"employer_id": employer_id_str}}
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    logger.info(f"Updated job {job_id}")
                else:
                    logger.warning(f"Failed to update job {job_id}")
        except Exception as e:
            error_count += 1
            logger.error(f"Error processing job {job.get('_id')}: {e}")
    
    logger.info(f"Completed fixing employer_id formats. Updated: {updated_count}, Errors: {error_count}")

async def main():
    try:
        logger.info("Starting employer ID fix script...")
        await fix_employer_ids()
        logger.info("Script completed successfully")
    except Exception as e:
        logger.error(f"Error running script: {e}")
    finally:
        # Close MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(main()) 