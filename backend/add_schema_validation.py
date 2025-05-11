import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Database connection string
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")

async def add_schema_validation():
    """Add schema validation to the users collection"""
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to database: {DATABASE_NAME}")
    
    try:
        # Define schema validation for the users collection
        user_schema = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["email", "full_name", "is_verified"],
                "properties": {
                    "email": {
                        "bsonType": "string",
                        "description": "Email must be a string and is required"
                    },
                    "full_name": {
                        "bsonType": "string",
                        "description": "Full name must be a string and is required"
                    },
                    "is_verified": {
                        "bsonType": "bool",
                        "description": "is_verified must be a boolean value and is required"
                    },
                    "verification_pending": {
                        "bsonType": "bool",
                        "description": "verification_pending must be a boolean value if present"
                    }
                }
            }
        }
        
        # Log what we're about to do
        logger.info("Adding schema validation to users collection")
        
        # We need to use the regular MongoDB client (not Motor) for DB commands
        # Get a direct connection to the MongoDB server
        regular_client = MongoClient(MONGODB_URI)
        regular_db = regular_client[DATABASE_NAME]
        
        # Create a validator for the collection
        cmd = {
            "collMod": "users",
            "validator": user_schema,
            "validationLevel": "moderate"  # Use moderate to validate on updates but not fail on existing docs
        }
        
        # Run the command to add the validator
        result = regular_db.command(cmd)
        logger.info(f"Schema validation result: {result}")
        
        logger.info("Schema validation added successfully to users collection")
        
    except Exception as e:
        logger.error(f"Error adding schema validation: {e}")
    finally:
        # Close the connection
        client.close()

if __name__ == "__main__":
    asyncio.run(add_schema_validation()) 