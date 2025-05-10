#!/usr/bin/env python
"""
Standalone script to create MongoDB indexes.

This script can be run manually to create or update database indexes
without having to restart the server.

Usage:
    python -m backend.scripts.create_indexes
"""

import asyncio
import sys
import os
import logging
from pathlib import Path

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.config.database import connect_to_mongo, close_mongo_connection
from app.config.indexes import create_indexes

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def main():
    """Connect to MongoDB and create indexes."""
    try:
        logger.info("Connecting to MongoDB...")
        await connect_to_mongo()
        
        logger.info("Creating database indexes...")
        await create_indexes()
        
        logger.info("Database indexes created successfully!")
    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")
        sys.exit(1)
    finally:
        logger.info("Closing MongoDB connection...")
        await close_mongo_connection()

if __name__ == "__main__":
    logger.info("Starting database index creation script...")
    asyncio.run(main())
    logger.info("Index creation script completed.") 