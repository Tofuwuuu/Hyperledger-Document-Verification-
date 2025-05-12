import os
import sys
import pymongo
from pathlib import Path

# Check MongoDB connection
print("Testing MongoDB connection...")
try:
    # Try to connect to MongoDB
    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    
    # Check if the server is available
    client.admin.command('ping')
    
    print("MongoDB connection successful!")
    print(f"Available databases: {client.list_database_names()}")
    
except Exception as e:
    print(f"MongoDB connection error: {e}")
    print("Please make sure MongoDB service is running.")
    sys.exit(1)

# Create and configure .env file
print("\nCreating .env file...")
env_path = Path("backend") / ".env"
with open(env_path, "w", encoding="utf-8") as f:
    f.write("MONGODB_URL=mongodb://localhost:27017/cvsu_alumni\n")
    f.write("MONGODB_DB=cvsu_alumni\n")
    f.write("ALLOW_MOCK_DB=true\n")  # Fallback to mock DB if MongoDB connection fails
print(f".env file created at {env_path}")

# Attempt to modify database.py to fix connection issues
print("\nChecking database.py...")
db_file_path = Path("backend") / "app" / "config" / "database.py"

try:
    if db_file_path.exists():
        # Create a backup
        backup_path = db_file_path.with_suffix(".py.bak")
        with open(db_file_path, "r", encoding="utf-8") as src:
            with open(backup_path, "w", encoding="utf-8") as dst:
                dst.write(src.read())
        print(f"Created backup at {backup_path}")
        
        # Read the database.py file
        with open(db_file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Replace the connect_to_mongo function to increase timeouts and improve error handling
        if "async def connect_to_mongo():" in content:
            # Find the start and end of the function
            start = content.find("async def connect_to_mongo():")
            next_def = content.find("async def", start + 1)
            if next_def == -1:
                next_def = content.find("def", start + 1)
            if next_def == -1:
                print("Could not find the end of connect_to_mongo function")
                sys.exit(1)
            
            # Extract the function content
            function_content = content[start:next_def]
            
            # Replace with improved function
            new_function = '''async def connect_to_mongo():
    """Connect to MongoDB."""
    global client, db, MONGODB_DB, mock_db
    try:
        logger.info(f"Attempting to connect to MongoDB at {MONGODB_URL.split('@')[-1] if '@' in MONGODB_URL else 'localhost'}")
        
        # Set a server selection timeout (in milliseconds)
        client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=30000,    # Increased timeout for server selection
            connectTimeoutMS=30000,            # Increased connection timeout
            socketTimeoutMS=60000,             # Increased socket timeout
            maxIdleTimeMS=180000,              # Increased idle time
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
            mock_db = create_mock_db()
        return False
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failure: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        # Create mock database for development/testing if allowed
        if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
            mock_db = create_mock_db()
        return False
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        db = None
        logger.error("MongoDB connection failed but service will continue running with limited functionality")
        # Create mock database for development/testing if allowed
        if os.getenv("ALLOW_MOCK_DB", "").lower() == "true":
            mock_db = create_mock_db()
        return False'''
            
            # Replace the function in the content
            new_content = content.replace(function_content, new_function)
            
            # Write back to the file
            with open(db_file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            
            print("Successfully modified database.py with improved connection settings")
        else:
            print("Could not find connect_to_mongo function in database.py")
            sys.exit(1)
    else:
        print(f"Database file {db_file_path} not found")
        sys.exit(1)
except Exception as e:
    print(f"Error modifying database.py: {e}")
    sys.exit(1)

print("\nFix completed successfully!")
print("Try running your application again with:")
print("cd backend && python run.py") 