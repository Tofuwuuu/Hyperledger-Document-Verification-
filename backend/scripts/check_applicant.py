import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Replace with your actual MongoDB connection string
MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "alumni_portal"  # Replace with your actual database name

async def check_applicant(applicant_id):
    """
    Check details about an applicant in both users and employers collections
    """
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    logger.info(f"Checking applicant with ID: {applicant_id}")
    
    # Try different ID formats
    id_to_check = applicant_id
    obj_id = None
    
    # Try to convert to ObjectId if it's a valid format
    if ObjectId.is_valid(applicant_id):
        obj_id = ObjectId(applicant_id)
        logger.info(f"Valid ObjectId format: {obj_id}")
    
    # Check in users collection
    user = None
    try:
        # Try with original ID format
        user = await db.users.find_one({"_id": id_to_check})
        
        # If not found and we have a valid ObjectId, try with that
        if not user and obj_id:
            user = await db.users.find_one({"_id": obj_id})
        
        if user:
            logger.info("Found in users collection:")
            logger.info(f"User data: {user}")
    except Exception as e:
        logger.error(f"Error checking users collection: {e}")
    
    # Check in employers collection
    employer = None
    try:
        # Try with original ID format
        employer = await db.employers.find_one({"_id": id_to_check})
        
        # If not found and we have a valid ObjectId, try with that
        if not employer and obj_id:
            employer = await db.employers.find_one({"_id": obj_id})
        
        if employer:
            logger.info("Found in employers collection:")
            logger.info(f"Employer data: {employer}")
    except Exception as e:
        logger.error(f"Error checking employers collection: {e}")
    
    # Check application collection to see what's stored there
    try:
        application = await db.applications.find_one({"applicant_id": id_to_check})
        if not application and obj_id:
            application = await db.applications.find_one({"applicant_id": obj_id})
        
        if application:
            logger.info("Found application with this applicant_id:")
            logger.info(f"Application data: {application}")
    except Exception as e:
        logger.error(f"Error checking applications collection: {e}")
    
    if not user and not employer:
        logger.warning(f"Applicant with ID {applicant_id} not found in either collection")
    
    client.close()

async def main():
    # Replace with the applicant ID from your application
    applicant_id = "YOUR_APPLICANT_ID_HERE"
    await check_applicant(applicant_id)

if __name__ == "__main__":
    asyncio.run(main()) 