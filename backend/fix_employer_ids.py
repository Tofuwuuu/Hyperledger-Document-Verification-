#!/usr/bin/env python
"""
Fix Employer IDs Script 
 
This script fixes inconsistent employer_id fields in job records to ensure they are all
stored as MongoDB ObjectIDs instead of strings.
"""

import asyncio
import os
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('fix_employer_ids.log')
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection details
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DATABASE", "alumni_system")

async def fix_employer_ids():
    """
    Fix all employer_id fields in the jobs collection to ensure consistency
    by converting string IDs to ObjectId.
    """
    # Create MongoDB client
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    logger.info("Starting employer_id fix process...")
    
    # Find all jobs with string employer_id
    string_id_jobs = await db.jobs.find({"employer_id": {"$type": "string"}}).to_list(length=None)
    logger.info(f"Found {len(string_id_jobs)} jobs with string employer_ids")
    
    fixed_count = 0
    error_count = 0
    
    # Process each job with a string employer_id
    for job in string_id_jobs:
        job_id = job["_id"]
        employer_id_str = job["employer_id"]
        
        try:
            # Convert string to ObjectId
            employer_id_obj = ObjectId(employer_id_str)
            
            # Check if this employer exists
            employer = await db.employers.find_one({"_id": employer_id_obj})
            if employer:
                # Update the job with ObjectId
                await db.jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"employer_id": employer_id_obj}}
                )
                logger.info(f"Fixed job {job_id} - Title: {job.get('title')} - Employer: {employer.get('company_name')}")
                fixed_count += 1
            else:
                logger.warning(f"No employer found with ID {employer_id_str} for job {job_id}")
                error_count += 1
                
        except Exception as e:
            logger.error(f"Error fixing job {job_id}: {str(e)}")
            error_count += 1
    
    # Log summary
    logger.info(f"Fix process complete.")
    logger.info(f"Total jobs processed: {len(string_id_jobs)}")
    logger.info(f"Successfully fixed: {fixed_count}")
    logger.info(f"Errors: {error_count}")
    
    # Verify results
    remaining_string_ids = await db.jobs.count_documents({"employer_id": {"$type": "string"}})
    logger.info(f"Remaining jobs with string employer_ids: {remaining_string_ids}")

async def main():
    """Main function to execute the fix process."""
    try:
        await fix_employer_ids()
        logger.info("Process completed successfully.")
    except Exception as e:
        logger.error(f"An error occurred during the fix process: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting employer ID fix script")
    asyncio.run(main())
    logger.info("Script execution complete") 