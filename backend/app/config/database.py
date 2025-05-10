import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from contextlib import asynccontextmanager

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB settings
# Get settings from environment variables only with safe defaults
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cvsu_alumni")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Log MongoDB connection info (without sensitive credentials)
connection_url = MONGODB_URL
if "://" in connection_url:
    # Mask the password in the connection string for logging
    parts = connection_url.split("://", 1)
    if "@" in parts[1]:
        auth_part = parts[1].split("@", 1)[0]
        if ":" in auth_part:
            # Replace password with asterisks but keep username
            username = auth_part.split(":", 1)[0]
            masked_url = f"{parts[0]}://{username}:********@{parts[1].split('@', 1)[1]}"
            logger.info(f"Using MongoDB connection: {masked_url}")
        else:
            logger.info(f"Using MongoDB connection to: {parts[1].split('@', 1)[1]}")
    else:
        logger.info(f"Using MongoDB connection to: {parts[1]}")
else:
    logger.info(f"Using MongoDB connection to localhost")

# For cloud deployments, ensure we have a valid MongoDB URL
if not MONGODB_URL or MONGODB_URL == "mongodb://localhost:27017/cvsu_alumni":
    # Check for cloud provider environment variables
    # Render.com provides DATABASE_URL for MongoDB
    cloud_mongodb_url = os.getenv("DATABASE_URL")
    if cloud_mongodb_url:
        logger.info("Found cloud MongoDB URL, using it instead of default localhost")
        MONGODB_URL = cloud_mongodb_url
    else:
        logger.warning("No cloud MongoDB URL found, using default localhost settings")

# MongoDB client instance
client = None
db = None

async def connect_to_mongo():
    """Connect to MongoDB."""
    global client, db
    try:
        logger.info(f"Attempting to connect to MongoDB at {MONGODB_URL.split('@')[-1] if '@' in MONGODB_URL else 'localhost'}")
        
        # Set a server selection timeout (in milliseconds)
        client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=10000,    # Increased from 5s to 10s
            connectTimeoutMS=20000,            # Increased from 10s to 20s
            socketTimeoutMS=45000,             # Increased from 30s to 45s
            maxIdleTimeMS=120000,              # Increased from 60s to 120s
            retryWrites=True,
            retryReads=True,                   # Add retry for read operations
            w="majority",                      # Ensure writes are acknowledged by a majority
            journal=True                       # Ensure writes are written to the journal
        )
        
        # Test the connection
        await client.admin.command('ping')
        
        # Extract database name from URL if it's not explicitly set
        # MongoDB URLs can include the database name after the last /
        if '/' in MONGODB_URL and not MONGODB_DB:
            potential_db_name = MONGODB_URL.split('/')[-1]
            # If there are query parameters, remove them
            if '?' in potential_db_name:
                potential_db_name = potential_db_name.split('?')[0]
            if potential_db_name:
                global MONGODB_DB
                MONGODB_DB = potential_db_name
                logger.info(f"Extracted database name from URL: {MONGODB_DB}")
                
        db = client[MONGODB_DB]
        logger.info(f"Connected to MongoDB at {MONGODB_URL.split('@')[-1] if '@' in MONGODB_URL else 'localhost'}, database: {MONGODB_DB}")
        
        # List collections to verify DB access
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        return True
            
    except ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB server selection timeout: {e}")
        # Set db to None to indicate connection failure
        db = None
        # Don't raise the exception to prevent app from crashing
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        return False
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failure: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        return False
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        return False

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
        logger.error(f"MongoDB database attempted: {MONGODB_DB}")
        # This will be caught and handled by the routes
        raise ConnectionError("Database connection not established. Please check that MongoDB is running and check your connection settings.")
    return db

async def get_database_async():
    """Return database instance asynchronously."""
    if db is None:
        logger.error("Database connection not established. MongoDB might not be running.")
        logger.error(f"MongoDB database attempted: {MONGODB_DB}")
        raise ConnectionError("Database connection not established. Please check that MongoDB is running.")
    return db 

@asynccontextmanager
async def get_transaction_session():
    """
    Context manager for MongoDB transactions.
    Usage:
        async with get_transaction_session() as session:
            async with session.start_transaction():
                # Perform multiple operations within the transaction
                await db.collection.insert_one(doc1, session=session)
                await db.collection.update_one(filter, update, session=session)
    """
    if client is None:
        raise ConnectionError("MongoDB client not initialized")
    
    try:
        session = await client.start_session()
        try:
            yield session
        finally:
            await session.end_session()
    except Exception as e:
        logger.error(f"Error in transaction session: {str(e)}")
        raise 