import asyncio
from datetime import datetime
import uuid
from bson import ObjectId
from app.config.database import get_database_async
from app.repositories.event_repository import EventRepository
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Event ID to add registrations for
EVENT_ID = "680a5fd9519908e1984e3cc1"

async def register_students():
    """Register actual users for the event using existing users in the database."""
    logger.info(f"Registering students for event ID: {EVENT_ID}")
    
    # Connect to database
    db = await get_database_async()
    
    # Get the event
    event = await db.events.find_one({"_id": ObjectId(EVENT_ID)})
    if not event:
        logger.error(f"Event not found with ID: {EVENT_ID}")
        return False
    
    # Get some existing users to register
    users = []
    cursor = db.users.find({}).limit(3)  # Fetch up to 3 users
    async for user in cursor:
        users.append(user)
    
    if not users:
        logger.error("No users found in the database")
        return False
    
    logger.info(f"Found {len(users)} users to register for event")
    
    # Register each user for the event
    registrations_added = 0
    for user in users:
        user_id = user["_id"]
        
        # Check if user is already registered
        existing = await db.event_registrations.find_one({
            "event_id": ObjectId(EVENT_ID),
            "user_id": user_id
        })
        
        if existing:
            logger.info(f"User {user_id} is already registered for this event")
            continue
        
        # Create registration
        registration_data = {
            "event_id": ObjectId(EVENT_ID),
            "user_id": user_id,
            "status": "registered",
            "registration_date": datetime.utcnow(),
            "qr_code_data": f"{str(uuid.uuid4())}-{EVENT_ID}-{user_id}"
        }
        
        # Insert the registration
        try:
            result = await db.event_registrations.insert_one(registration_data)
            logger.info(f"Registered user {user_id} for event")
            
            # Increment the registration count for the event
            await EventRepository.increment_registration_count(ObjectId(EVENT_ID))
            
            registrations_added += 1
        except Exception as e:
            logger.error(f"Error registering user {user_id}: {str(e)}")
    
    logger.info(f"Added {registrations_added} registrations to event")
    print(f"✅ Successfully registered {registrations_added} students for the event")
    
    # Get updated registration count
    event = await db.events.find_one({"_id": ObjectId(EVENT_ID)})
    count = await db.event_registrations.count_documents({"event_id": ObjectId(EVENT_ID)})
    print(f"Current registration count: {count}")
    print(f"Event registration_count field: {event.get('registration_count', 0)}")
    
    return True

if __name__ == "__main__":
    asyncio.run(register_students()) 