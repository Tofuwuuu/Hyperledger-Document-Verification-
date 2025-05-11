import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Database connection string
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")

async def migrate_verification_field():
    """Migrate all user records to standardize is_verified field to boolean type"""
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to database: {DATABASE_NAME}")
    
    try:
        # Count total users
        total_users = await db.users.count_documents({})
        logger.info(f"Total users in database: {total_users}")
        
        # Check for different values of is_verified
        pipeline = [
            {"$group": {"_id": {"value": "$is_verified", "type": {"$type": "$is_verified"}}, "count": {"$sum": 1}}}
        ]
        logger.info("Current is_verified values in database:")
        async for result in db.users.aggregate(pipeline):
            # Safely access values with error handling
            try:
                value_info = result.get("_id", {})
                value = value_info.get("value", "N/A")
                type_name = value_info.get("type", "unknown")
                count = result.get("count", 0)
                logger.info(f"Value: {value}, Type: {type_name}, Count: {count}")
            except Exception as err:
                logger.error(f"Error processing result: {err}")
                logger.info(f"Raw result: {result}")
        
        # Find users with non-boolean is_verified field
        non_bool_verified = await db.users.count_documents({
            "is_verified": {"$exists": True, "$not": {"$type": "bool"}}
        })
        logger.info(f"Users with non-boolean is_verified: {non_bool_verified}")
        
        # Find users missing is_verified field
        missing_verified = await db.users.count_documents({
            "is_verified": {"$exists": False}
        })
        logger.info(f"Users missing is_verified field: {missing_verified}")
        
        # Process users with incorrect or missing is_verified field
        
        # 1. Update users with non-boolean true-like values
        true_result = await db.users.update_many(
            {
                "$or": [
                    {"is_verified": "true"},
                    {"is_verified": 1},
                    {"is_verified": "1"},
                    {"is_verified": "yes"},
                    {"is_verified": "y"}
                ]
            },
            {"$set": {"is_verified": True, "updated_at": datetime.utcnow()}}
        )
        logger.info(f"Updated {true_result.modified_count} users with true-like values to boolean True")
        
        # 2. Update users with non-boolean false-like values
        false_result = await db.users.update_many(
            {
                "$or": [
                    {"is_verified": "false"},
                    {"is_verified": 0},
                    {"is_verified": "0"},
                    {"is_verified": "no"},
                    {"is_verified": "n"},
                    {"is_verified": ""}
                ]
            },
            {"$set": {"is_verified": False, "updated_at": datetime.utcnow()}}
        )
        logger.info(f"Updated {false_result.modified_count} users with false-like values to boolean False")
        
        # 3. Add is_verified=False to users missing the field
        missing_result = await db.users.update_many(
            {"is_verified": {"$exists": False}},
            {"$set": {"is_verified": False, "updated_at": datetime.utcnow()}}
        )
        logger.info(f"Added is_verified=False to {missing_result.modified_count} users missing the field")
        
        # Check results after migration
        pipeline = [
            {"$group": {"_id": {"value": "$is_verified", "type": {"$type": "$is_verified"}}, "count": {"$sum": 1}}}
        ]
        logger.info("is_verified values after migration:")
        async for result in db.users.aggregate(pipeline):
            try:
                value_info = result.get("_id", {})
                value = value_info.get("value", "N/A")
                type_name = value_info.get("type", "unknown")
                count = result.get("count", 0)
                logger.info(f"Value: {value}, Type: {type_name}, Count: {count}")
            except Exception as err:
                logger.error(f"Error processing result: {err}")
                logger.info(f"Raw result: {result}")
        
        # Verify all users now have a boolean is_verified field
        remaining_issues = await db.users.count_documents({
            "$or": [
                {"is_verified": {"$exists": False}},
                {"is_verified": {"$exists": True, "$not": {"$type": "bool"}}}
            ]
        })
        
        if remaining_issues == 0:
            logger.info("Migration successful! All users now have a boolean is_verified field.")
        else:
            logger.warning(f"Migration incomplete. {remaining_issues} users still have issues with is_verified field.")
            
    except Exception as e:
        logger.error(f"Error migrating verification field: {e}")
        # Print stack trace for debugging
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # Close the connection
        client.close()

if __name__ == "__main__":
    asyncio.run(migrate_verification_field()) 