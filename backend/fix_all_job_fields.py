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
        logging.FileHandler("fix_jobs_collection.log"),
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

async def fix_jobs_collection():
    """
    Comprehensive fix for jobs collection, ensuring:
    1. All employer_id fields are strings
    2. Check for missing required fields
    3. Log and report all issues
    """
    logger.info("Starting comprehensive jobs collection fix...")
    
    # Get all jobs
    cursor = db.jobs.find({})
    updated_count = 0
    error_count = 0
    missing_employer_id = 0
    
    async for job in cursor:
        try:
            job_id = job["_id"]
            logger.info(f"Processing job {job_id}")
            
            # Check for updates needed
            updates = {}
            
            # 1. Check employer_id format
            employer_id = job.get("employer_id")
            if employer_id is None:
                logger.error(f"Job {job_id} is missing employer_id field")
                missing_employer_id += 1
                
                # Try to look up in applications or other records to find employer
                # For now, we'll just log it
            elif not isinstance(employer_id, str):
                # Convert to string
                employer_id_str = str(employer_id)
                logger.info(f"Job {job_id}: Converting employer_id from {type(employer_id)} to string: {employer_id_str}")
                updates["employer_id"] = employer_id_str
            
            # If we have updates, apply them
            if updates:
                result = await db.jobs.update_one(
                    {"_id": job_id},
                    {"$set": updates}
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    logger.info(f"Updated job {job_id}")
                else:
                    logger.warning(f"Failed to update job {job_id}")
            else:
                logger.info(f"No updates needed for job {job_id}")
                
        except Exception as e:
            error_count += 1
            logger.error(f"Error processing job {job.get('_id', 'unknown')}: {e}")
    
    # Summary report
    logger.info("=== Jobs Collection Repair Summary ===")
    logger.info(f"Updated records: {updated_count}")
    logger.info(f"Errors encountered: {error_count}")
    logger.info(f"Missing employer_id fields: {missing_employer_id}")
    logger.info("=====================================")

async def list_jobs():
    """List all jobs and their employer_id values for inspection"""
    logger.info("Listing all jobs and their employer_id values...")
    
    cursor = db.jobs.find({})
    job_count = 0
    
    async for job in cursor:
        job_id = job["_id"]
        employer_id = job.get("employer_id")
        employer_id_type = type(employer_id).__name__
        
        logger.info(f"Job {job_id}: employer_id={employer_id} (type={employer_id_type})")
        job_count += 1
    
    logger.info(f"Total jobs: {job_count}")

async def main():
    try:
        logger.info("Starting jobs collection repair script...")
        
        # First list all jobs
        await list_jobs()
        
        # Then fix any issues
        await fix_jobs_collection()
        
        # List again to verify changes
        await list_jobs()
        
        logger.info("Script completed successfully")
    except Exception as e:
        logger.error(f"Error running script: {e}")
    finally:
        # Close MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(main()) 