#!/usr/bin/env python
"""
Script to check and fix employer account issues
"""

import asyncio
import sys
import os
import logging
from bson import ObjectId

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.config.database import get_database
from app.core.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting employer account fix script")
    
    # Connect to database
    db = get_database()
    
    # 1. Check and list all employer accounts
    logger.info("Checking employer accounts...")
    employers = await db.employers.find({}).to_list(length=100)
    
    logger.info(f"Found {len(employers)} employer accounts")
    for idx, employer in enumerate(employers):
        logger.info(f"Employer {idx+1}: {employer.get('email')} - Active: {employer.get('is_active', False)}")
    
    # 2. Set is_active flag to True for all employers if needed
    active_updates = 0
    for employer in employers:
        if not employer.get('is_active', True):
            employer_id = employer.get('_id')
            logger.info(f"Setting is_active=True for employer: {employer.get('email')}")
            result = await db.employers.update_one(
                {"_id": employer_id},
                {"$set": {"is_active": True}}
            )
            if result.modified_count > 0:
                active_updates += 1
    
    logger.info(f"Updated is_active flag for {active_updates} employers")
    
    # 3. Check for specific accounts 
    email_to_check = "allan.mendoza@nextgenrobotics.ph"
    employer = await db.employers.find_one({"email": email_to_check})
    
    if employer:
        logger.info(f"Found employer with email {email_to_check}")
        logger.info(f"ID: {employer.get('_id')}")
        logger.info(f"Active: {employer.get('is_active', False)}")
        
        # Fix the employer if not active
        if not employer.get('is_active', True):
            logger.info(f"Setting is_active=True for {email_to_check}")
            result = await db.employers.update_one(
                {"email": email_to_check},
                {"$set": {"is_active": True}}
            )
            logger.info(f"Update result: {result.modified_count} document(s) modified")
    else:
        logger.warning(f"Employer with email {email_to_check} not found")
    
    logger.info("Script completed successfully")

if __name__ == "__main__":
    asyncio.run(main()) 