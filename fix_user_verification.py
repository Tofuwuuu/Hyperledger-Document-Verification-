#!/usr/bin/env python3
"""
Fix User Verification Script

This script updates a user's verification status in the database.
It's intended to be used when a user's documents are verified, but their account
still shows as unverified.
"""

import asyncio
import os
import sys
import logging
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cvsu_alumni")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Check for Render.com environment variables
cloud_mongodb_url = os.getenv("DATABASE_URL") or os.getenv("MONGODB_URI")
if cloud_mongodb_url:
    MONGODB_URL = cloud_mongodb_url
    logger.info(f"Using cloud MongoDB URL: {cloud_mongodb_url.split('@')[-1]}")

# Specific user ID to fix (hardcoded for direct fix)
TARGET_USER_ID = "6804c06543846509ed9ba2ed"

async def fix_user_verification(user_id=TARGET_USER_ID):
    """Fix user verification status in the database."""
    if not user_id:
        logger.error("No user ID specified")
        return False
    
    logger.info(f"Attempting to fix verification status for user ID: {user_id}")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Find the user by ID
        user = await db.users.find_one({"_id": user_id})
        
        if not user:
            logger.error(f"User not found with ID: {user_id}")
            return False
        
        logger.info(f"Found user: {user.get('email')} (ID: {user.get('_id')})")
        logger.info(f"Current verification status: is_verified={user.get('is_verified', False)}")
        
        # Update the user verification status
        now = datetime.utcnow()
        result = await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "is_verified": True,
                "verification_date": now,
                "verification_pending": False,
                "verification_notes": "Fixed via script",
                "updated_at": now
            }}
        )
        
        if result.modified_count == 0:
            logger.warning("No changes made to user record. User might already be verified.")
        else:
            logger.info(f"Successfully updated verification status for user: {user.get('email')}")
        
        # Verify the change
        updated_user = await db.users.find_one({"_id": user["_id"]})
        logger.info(f"Updated verification status: is_verified={updated_user.get('is_verified', False)}")
        
        # Also check and fix alumni record if it exists
        alumni = await db.alumni.find_one({"user_id": str(user["_id"])})
        if alumni:
            logger.info(f"Found matching alumni record: {alumni.get('_id')}")
            
            # Update alumni verification status if needed
            if not alumni.get('is_verified', False):
                alumni_result = await db.alumni.update_one(
                    {"_id": alumni["_id"]},
                    {"$set": {
                        "is_verified": True,
                        "verification_date": now,
                        "verification_pending": False,
                        "updated_at": now
                    }}
                )
                
                if alumni_result.modified_count > 0:
                    logger.info(f"Updated alumni verification status as well")
        else:
            logger.warning(f"No alumni record found for user ID: {user_id}")
        
        # Check if there's a notification about pending verification and mark it as read
        try:
            notification_result = await db.notifications.update_many(
                {
                    "user_id": str(user["_id"]),
                    "type": {"$in": ["verification", "verification_pending", "account_verification"]},
                    "is_read": False
                },
                {
                    "$set": {
                        "is_read": True,
                        "updated_at": now
                    }
                }
            )
            
            if notification_result.modified_count > 0:
                logger.info(f"Marked {notification_result.modified_count} verification notifications as read")
        except Exception as e:
            logger.error(f"Error updating notifications: {str(e)}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error fixing user verification: {str(e)}")
        return False
    finally:
        # Close the MongoDB connection
        if 'client' in locals():
            client.close()

async def main():
    # Run with hardcoded user ID
    success = await fix_user_verification()
    
    if success:
        print(f"✅ Successfully updated verification status for user ID: {TARGET_USER_ID}")
        print("Please tell the user to log out and log back in for changes to take effect.")
    else:
        print(f"❌ Failed to update verification status for user ID: {TARGET_USER_ID}")

if __name__ == "__main__":
    asyncio.run(main()) 