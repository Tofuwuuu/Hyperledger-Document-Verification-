"""
This script recalculates and updates event registration counts to ensure they match 
the actual number of registrations in the database.
"""
import asyncio
import sys
import os
import logging
from bson import ObjectId

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import get_database_async
from app.repositories.event_repository import EventRepository

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def fix_event_registration_counts():
    try:
        logger.info("Starting event registration count fix...")
        db = await get_database_async()
        
        # Get all events
        events = await db["events"].find({}).to_list(length=None)
        logger.info(f"Found {len(events)} events to check")
        
        fixed_count = 0
        
        for event in events:
            event_id = event["_id"]
            current_count = event.get("registration_count", 0)
            
            # Count actual registrations for this event
            actual_count = await db["event_registrations"].count_documents({"event_id": event_id})
            
            if current_count != actual_count:
                logger.info(f"Mismatch found for event '{event.get('title')}' (ID: {event_id}):")
                logger.info(f"  Current count: {current_count}, Actual count: {actual_count}")
                
                # Update the event with the correct count
                await db["events"].update_one(
                    {"_id": event_id},
                    {"$set": {"registration_count": actual_count}}
                )
                fixed_count += 1
        
        logger.info(f"Fix completed. Updated {fixed_count} events with corrected registration counts.")
    except Exception as e:
        logger.error(f"Error fixing event registration counts: {str(e)}")
        raise

async def main():
    try:
        await fix_event_registration_counts()
        logger.info("Script completed successfully.")
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
    finally:
        # Close any open connections
        db = await get_database_async()
        if db.client:
            db.client.close()

if __name__ == "__main__":
    asyncio.run(main()) 