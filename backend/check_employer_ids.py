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
        logging.FileHandler("employer_id_check.log"),
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

async def check_employers():
    """Check how employers are stored in the database"""
    logger.info("=== Checking Employers Collection ===")
    
    # Count employers
    count = await db.employers.count_documents({})
    logger.info(f"Total employers: {count}")
    
    # Get sample employers
    employers = await db.employers.find({}).limit(5).to_list(length=5)
    
    for i, employer in enumerate(employers):
        logger.info(f"Employer {i+1}:")
        logger.info(f"  _id: {employer['_id']} (Type: {type(employer['_id']).__name__})")
        logger.info(f"  email: {employer.get('email')}")
        logger.info(f"  company_name: {employer.get('company_name')}")
        
        # Check how many jobs this employer has
        jobs_count = await db.jobs.count_documents({"employer_id": str(employer['_id'])})
        logger.info(f"  Jobs with string employer_id: {jobs_count}")
        
        # Try with ObjectId
        try:
            obj_id_count = await db.jobs.count_documents({"employer_id": employer['_id']})
            logger.info(f"  Jobs with ObjectId employer_id: {obj_id_count}")
        except Exception as e:
            logger.error(f"  Error checking ObjectId jobs: {e}")

async def check_jobs():
    """Check how employer_id is stored in jobs collection"""
    logger.info("=== Checking Jobs Collection ===")
    
    # Count jobs
    count = await db.jobs.count_documents({})
    logger.info(f"Total jobs: {count}")
    
    # Count jobs with string employer_id
    string_count = await db.jobs.count_documents({"employer_id": {"$type": "string"}})
    logger.info(f"Jobs with string employer_id: {string_count}")
    
    # Count jobs with ObjectId employer_id
    obj_count = await db.jobs.count_documents({"employer_id": {"$type": "objectId"}})
    logger.info(f"Jobs with ObjectId employer_id: {obj_count}")
    
    # Count jobs with missing employer_id
    missing_count = await db.jobs.count_documents({"employer_id": {"$exists": False}})
    logger.info(f"Jobs with missing employer_id: {missing_count}")
    
    # Get sample jobs
    jobs = await db.jobs.find({}).limit(5).to_list(length=5)
    
    for i, job in enumerate(jobs):
        logger.info(f"Job {i+1}:")
        logger.info(f"  _id: {job['_id']} (Type: {type(job['_id']).__name__})")
        logger.info(f"  title: {job.get('title')}")
        
        employer_id = job.get('employer_id')
        if employer_id:
            logger.info(f"  employer_id: {employer_id} (Type: {type(employer_id).__name__})")
            
            # Try to find employer with this ID
            employer = None
            
            # First try direct lookup
            try:
                employer = await db.employers.find_one({"_id": employer_id})
            except Exception:
                pass
                
            # If not found and employer_id is string, try with ObjectId
            if not employer and isinstance(employer_id, str):
                try:
                    obj_id = ObjectId(employer_id)
                    employer = await db.employers.find_one({"_id": obj_id})
                    if employer:
                        logger.info(f"  Found employer with ObjectId conversion: {employer.get('company_name')}")
                except Exception as e:
                    logger.error(f"  Error converting to ObjectId: {e}")
            
            if employer:
                logger.info(f"  Employer name: {employer.get('company_name')}")
            else:
                logger.error(f"  No employer found for ID: {employer_id}")
        else:
            logger.error(f"  No employer_id found for this job")

async def test_employer_lookup():
    """Test employer lookup with different ID formats"""
    logger.info("=== Testing Employer Lookup ===")
    
    # Get a sample employer
    sample_employer = await db.employers.find_one({})
    
    if not sample_employer:
        logger.error("No employers found in database")
        return
        
    logger.info(f"Sample employer: {sample_employer.get('company_name')}")
    
    # Get the ID in different formats
    obj_id = sample_employer['_id']
    str_id = str(obj_id)
    
    logger.info(f"ObjectId: {obj_id} (Type: {type(obj_id).__name__})")
    logger.info(f"String ID: {str_id} (Type: {type(str_id).__name__})")
    
    # Test lookup with ObjectId
    employer1 = await db.employers.find_one({"_id": obj_id})
    logger.info(f"Lookup with ObjectId: {employer1 is not None}")
    
    # Test lookup with string ID
    employer2 = await db.employers.find_one({"_id": str_id})
    logger.info(f"Lookup with string ID: {employer2 is not None}")
    
    # Test lookup with string ID converted to ObjectId
    employer3 = await db.employers.find_one({"_id": ObjectId(str_id)})
    logger.info(f"Lookup with string ID converted to ObjectId: {employer3 is not None}")

async def fix_employer_ids_in_jobs():
    """Convert all employer_id fields in jobs to strings for consistency"""
    logger.info("=== Converting employer_id to Strings ===")
    
    # Count jobs with ObjectId employer_id
    obj_count = await db.jobs.count_documents({"employer_id": {"$type": "objectId"}})
    logger.info(f"Jobs with ObjectId employer_id: {obj_count}")
    
    if obj_count == 0:
        logger.info("No jobs with ObjectId employer_id to convert")
        return
        
    # Get all jobs with ObjectId employer_id
    jobs = await db.jobs.find({"employer_id": {"$type": "objectId"}}).to_list(length=None)
    
    updated_count = 0
    for job in jobs:
        try:
            job_id = job["_id"]
            employer_id = job["employer_id"]
            employer_id_str = str(employer_id)
            
            # Update to string format
            result = await db.jobs.update_one(
                {"_id": job_id},
                {"$set": {"employer_id": employer_id_str}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"Updated job {job_id}: employer_id converted to string")
        except Exception as e:
            logger.error(f"Error updating job {job.get('_id')}: {e}")
    
    logger.info(f"Updated {updated_count} jobs with string employer_ids")
    
    # Verify all are now strings
    string_count = await db.jobs.count_documents({"employer_id": {"$type": "string"}})
    obj_count = await db.jobs.count_documents({"employer_id": {"$type": "objectId"}})
    logger.info(f"Final counts - String: {string_count}, ObjectId: {obj_count}")

async def main():
    try:
        logger.info("Starting employer ID diagnostic script...")
        
        # Check employers collection
        await check_employers()
        
        # Check jobs collection
        await check_jobs()
        
        # Test employer lookup
        await test_employer_lookup()
        
        # Ask user if they want to fix employer IDs
        fix_ids = input("Would you like to convert all employer_id fields in jobs to strings? (y/n): ")
        if fix_ids.lower() == 'y':
            await fix_employer_ids_in_jobs()
        
        logger.info("Diagnostic script completed")
    except Exception as e:
        logger.error(f"Error running script: {e}")
    finally:
        # Close MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(main()) 