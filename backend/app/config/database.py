import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from contextlib import asynccontextmanager
import json
from unittest.mock import MagicMock

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB settings
# Get settings from environment variables only with safe defaults
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cvsu_alumni")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Check for common cloud provider environment variables
# Render.com provides DATABASE_URL for MongoDB
cloud_mongodb_url = os.getenv("DATABASE_URL")
if cloud_mongodb_url:
    logger.info("Found cloud DATABASE_URL, using it instead of MONGODB_URL")
    MONGODB_URL = cloud_mongodb_url

# MongoDB Atlas connection string - Render.com often provides this
mongodb_atlas_uri = os.getenv("MONGODB_URI") 
if mongodb_atlas_uri:
    logger.info("Found MongoDB Atlas URI, using it instead of other connection strings")
    MONGODB_URL = mongodb_atlas_uri

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
mock_db = None

# Create a mock database instance for development/testing
def create_mock_db():
    global mock_db
    logger.warning("Creating mock database for development/testing")
    mock_db = MagicMock()
    
    # Define some basic collections
    mock_collections = ['users', 'alumni', 'documents', 'roles', 'permissions', 'notifications']
    
    # Set up mock data
    mock_users = [
        {
            "_id": "60d21b4667d0d8992e610c85",
            "email": "admin@cvsu.edu.ph",
            "full_name": "Admin User",
            "hashed_password": "hashed_password",
            "is_active": True,
            "is_admin": True,
            "is_verified": True,
            "created_at": "2023-01-01T00:00:00.000Z",
            "updated_at": "2023-01-01T00:00:00.000Z"
        }
    ]
    
    # Set up mock methods for each collection
    for collection_name in mock_collections:
        collection_mock = MagicMock()
        setattr(mock_db, collection_name, collection_mock)
        
        # Mock find_one method to return a mock document if it exists
        if collection_name == 'users':
            async def mock_find_one(filter=None, *args, **kwargs):
                if filter and 'email' in filter:
                    for user in mock_users:
                        if user['email'] == filter['email']:
                            return user
                return None
            collection_mock.find_one = mock_find_one
        
        # Add other methods that might be called
        async def mock_find(*args, **kwargs):
            find_cursor = MagicMock()
            find_cursor.to_list = lambda length: []
            return find_cursor
        
        async def mock_insert_one(*args, **kwargs):
            insert_result = MagicMock()
            insert_result.inserted_id = "mock_id"
            return insert_result
        
        async def mock_update_one(*args, **kwargs):
            update_result = MagicMock()
            update_result.modified_count = 1
            return update_result
        
        async def mock_delete_one(*args, **kwargs):
            delete_result = MagicMock()
            delete_result.deleted_count = 1
            return delete_result
        
        async def mock_count_documents(*args, **kwargs):
            return 0
        
        collection_mock.find = mock_find
        collection_mock.insert_one = mock_insert_one
        collection_mock.update_one = mock_update_one
        collection_mock.delete_one = mock_delete_one
        collection_mock.count_documents = mock_count_documents
    
    return mock_db

async def connect_to_mongo():
    """Connect to MongoDB."""
    global client, db, MONGODB_DB
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
        # Create mock database for development/testing if allowed
        if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
            global mock_db
            mock_db = create_mock_db()
        return False
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failure: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        # Create mock database for development/testing if allowed
        if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
            global mock_db
            mock_db = create_mock_db()
        return False
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        # Create mock database for development/testing if allowed
        if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
            global mock_db
            mock_db = create_mock_db()
        return False

async def close_mongo_connection():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection")

def get_database():
    """Return database instance."""
    global db, mock_db
    
    if db is not None:
        return db
    
    # Return mock database if available
    if mock_db is not None:
        logger.warning("Using mock database for development/testing")
        return mock_db
    
    # Report more detailed error information
    connection_url = MONGODB_URL
    # Mask any password in the URL for logging
    if "://" in connection_url and "@" in connection_url:
        parts = connection_url.split("://", 1)
        auth_part = parts[1].split("@", 1)[0]
        if ":" in auth_part:
            username = auth_part.split(":", 1)[0]
            masked_url = f"{parts[0]}://{username}:****@{parts[1].split('@', 1)[1]}"
            logger.error(f"Failed to connect to MongoDB at {masked_url}")
        else:
            logger.error(f"Failed to connect to MongoDB at {parts[0]}://{parts[1].split('@', 1)[1]}")
    else:
        logger.error(f"Failed to connect to MongoDB at {MONGODB_URL}")
        
    logger.error("Database connection not established. MongoDB might not be running.")
    logger.error(f"MongoDB database attempted: {MONGODB_DB}")
    logger.error(f"Environment variables: DATABASE_URL exists: {bool(os.getenv('DATABASE_URL'))}, MONGODB_URI exists: {bool(os.getenv('MONGODB_URI'))}")
    
    # Create and return a mock database for development/testing if configured
    if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
        global mock_db
        mock_db = create_mock_db()
        return mock_db
        
    # This will be caught and handled by the routes
    raise ConnectionError("Database connection not established. Please check that MongoDB is running and check your connection settings.")

async def get_database_async():
    """Return database instance asynchronously."""
    global db, mock_db
    
    if db is not None:
        return db
    
    # Return mock database if available
    if mock_db is not None:
        logger.warning("Using mock database for development/testing")
        return mock_db
    
    logger.error("Database connection not established. MongoDB might not be running.")
    logger.error(f"MongoDB database attempted: {MONGODB_DB}")
    
    # Create and return a mock database for development/testing if configured
    if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
        global mock_db
        mock_db = create_mock_db()
        return mock_db
    
    raise ConnectionError("Database connection not established. Please check that MongoDB is running.")

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
    global client, mock_db
    
    if client is not None:
        try:
            session = await client.start_session()
            try:
                yield session
            finally:
                await session.end_session()
        except Exception as e:
            logger.error(f"Error in transaction session: {str(e)}")
            raise
    elif mock_db is not None:
        # Provide a mock session for development/testing
        logger.warning("Using mock transaction session")
        mock_session = MagicMock()
        mock_session.start_transaction = MagicMock()
        mock_session.__aenter__ = MagicMock(return_value=mock_session)
        mock_session.__aexit__ = MagicMock(return_value=None)
        yield mock_session
    else:
        raise ConnectionError("MongoDB client not initialized") 