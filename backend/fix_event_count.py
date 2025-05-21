import asyncio
from bson import ObjectId
from app.config.database import get_database_async
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Event ID to fix
EVENT_ID = "680a5fd9519908e1984e3cc1"

async def fix_event_count():
    """Update the event's registration_count to match the actual number of registrations."""
    logger.info(f"Fixing registration count for event ID: {EVENT_ID}")
    
    # Connect to database
    db = await get_database_async()
    
    # Get the event
    event = await db.events.find_one({"_id": ObjectId(EVENT_ID)})
    if not event:
        logger.error(f"Event not found with ID: {EVENT_ID}")
        return
    
    # Count actual registrations for this event
    actual_count = await db.event_registrations.count_documents({"event_id": ObjectId(EVENT_ID)})
    current_count = event.get("registration_count", 0)
    
    logger.info(f"Event '{event.get('title')}' has registration_count={current_count}, but actual count={actual_count}")
    
    # Update the event's registration_count to match reality
    await db.events.update_one(
        {"_id": ObjectId(EVENT_ID)},
        {"$set": {"registration_count": actual_count}}
    )
    
    logger.info(f"Updated event registration_count from {current_count} to {actual_count}")
    print(f"✅ Updated event registration_count to {actual_count}")

if __name__ == "__main__":
    asyncio.run(fix_event_count()) 