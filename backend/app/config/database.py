import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# MongoDB client instance
client = None
db = None

async def connect_to_mongo():
    """Connect to MongoDB."""
    global client, db
    try:
        logger.info(f"Attempting to connect to MongoDB at {MONGODB_URL}")
        # Set a server selection timeout (in milliseconds)
        client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000,    # Increased from 2s to 5s
            connectTimeoutMS=10000,           # Increased from 5s to 10s
            socketTimeoutMS=30000,            # Increased from 10s to 30s
            maxIdleTimeMS=60000,              # Increased from 30s to 60s
            retryWrites=True
        )
        
        # Test the connection
        await client.admin.command('ping')
        
        db = client[MONGODB_DB]
        logger.info(f"Connected to MongoDB at {MONGODB_URL}, database: {MONGODB_DB}")
        
        # List collections to verify DB access
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        if 'document_requests' not in collections:
            logger.warning("document_requests collection does not exist in the database!")
            
    except ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB server selection timeout: {e}")
        # Set db to None to indicate connection failure
        db = None
        # Don't raise the exception to prevent app from crashing
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failure: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")

async def close_mongo_connection():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection")

def get_database():
    """Return database instance."""
    if db is None:
        logger.error("Database connection not established. MongoDB might not be running.")
        logger.error(f"MongoDB URL attempted: {MONGODB_URL}, DB: {MONGODB_DB}")
        # This will be caught and handled by the routes
        raise ConnectionError("Database connection not established. Please check that MongoDB is running and check your connection settings.")
    return db

async def get_database_async():
    """Return database instance asynchronously."""
    if db is None:
        logger.error("Database connection not established. MongoDB might not be running.")
        logger.error(f"MongoDB URL attempted: {MONGODB_URL}, DB: {MONGODB_DB}")
        raise ConnectionError("Database connection not established. Please check that MongoDB is running.")
    return db 