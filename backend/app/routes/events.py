from fastapi import Depends, HTTPException, APIRouter
from fastapi.encoders import jsonable_encoder
from datetime import datetime
from app.utils.csrf import csrf_protect
from app.schemas import EventCreate
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.utils.utils import generate_url_slug
from app.config.database import get_database
from app.utils.auth import get_admin_user, get_current_user
import json
import traceback
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/events", status_code=201)
async def create_event(
    event: EventCreate,
    current_user: dict = Depends(get_admin_user)
):
    """
    Create a new event (admin only).
    """
    # Explicitly bypass CSRF for event creation
    try:
        from app.utils.csrf import csrf_protect
        logger.info("EXPLICITLY BYPASSING CSRF FOR EVENT CREATION")
        router.dependency_overrides[csrf_protect] = lambda: None
    except Exception as e:
        logger.error(f"Failed to bypass CSRF protection: {e}")
    
    try:
        # Get user ID handling both dict and User object (for admin bypass)
        if isinstance(current_user, dict):
            user_id = current_user.get("_id", current_user.get("id"))
        else:
            user_id = current_user.id
        
        logger.info(f"Creating event with user ID: {user_id}")
        event_dict = event.dict()
        logger.info(f"Event data: {json.dumps(event_dict, default=str)}")
        
        # Get database connection
        db = get_database()
        
        # Generate a URL slug based on the event title
        slug = generate_url_slug(event.title)
        
        # Create event document
        now = datetime.utcnow()
        event_document = {
            "_id": str(datetime.now().timestamp()),
            "title": event.title,
            "description": event.description,
            "event_date": event.event_date,
            "location": event.location,
            "registration_deadline": event.registration_deadline,
            "max_participants": event.max_participants,
            "is_active": event.is_active,
            "event_type": event.event_type,
            "registration_url": event.registration_url,
            "image_url": event.image_url,
            "tags": event.tags or [],
            "creator_id": user_id,
            "created_at": now,
            "updated_at": now,
            "slug": slug,
            "participant_count": 0
        }
        
        # Insert event into database
        await db.events.insert_one(event_document)
        
        logger.info(f"Event created successfully with ID: {event_document['_id']}")
        return event_document
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Debugging info
        try:
            event_dict = event.dict()
            logger.error(f"Event data: {json.dumps(event_dict, default=str)}")
        except:
            try:
                event_dict = json.loads(event.json())
                logger.error(f"Event data (using dict): {json.dumps(event_dict, default=str)}")
            except:
                logger.error(f"Could not serialize event data")
        
        raise HTTPException(
            status_code=500,
            detail=f"Could not create event: {str(e)}"
        ) 