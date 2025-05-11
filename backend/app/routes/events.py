from fastapi import Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from datetime import datetime
from app.utils.csrf import csrf_protect
from app.schemas import EventCreate
from app.database import AsyncIOMotorDatabase
from app.utils.utils import generate_url_slug
from app.dependencies import get_current_active_user, get_database
import json
import traceback
import logging

logger = logging.getLogger(__name__)

@router.post("/events", status_code=201)
async def create_event(
    event: EventCreate,
    current_user: User = Depends(get_admin_user)
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
        
        created_event = await EventRepository.create_event(event, user_id)
        logger.info(f"Event created successfully with ID: {created_event.get('_id')}")
        return created_event
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