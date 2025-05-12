import uvicorn
import asyncio
import logging
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from app.config.database import connect_to_mongo, close_mongo_connection

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create uploads directory
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Create subdirectories
for subdir in ["profile_pictures", "documents"]:
    (uploads_dir / subdir).mkdir(exist_ok=True)

# Load environment variables
load_dotenv()

async def startup_db_check():
    """Check MongoDB connection before starting the server"""
    logger.info("Checking MongoDB connection...")
    connected = await connect_to_mongo()
    if not connected:
        logger.error("MongoDB connection failed. Make sure MongoDB is running.")
        logger.error("Run 'mongod' or start the MongoDB service before starting the backend.")
        sys.exit(1)
    logger.info("MongoDB connection successful. Starting server...")

if __name__ == "__main__":
    # Run the database check first
    asyncio.run(startup_db_check())
    
    # Get port from environment variables
    port = int(os.getenv("PORT", "8000"))
    
    # If we get here, the database connection was successful
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    ) 