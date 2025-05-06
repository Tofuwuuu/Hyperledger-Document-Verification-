from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from bson import ObjectId
from pydantic import parse_obj_as
import logging
import traceback
import json

from app.models.event import Event, EventCreate, EventUpdate
from app.models.common import PyObjectId
from app.repositories.event_repository import EventRepository
from app.utils.auth import get_current_user, get_current_active_user, get_admin_user
from app.models.user import User

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/events", response_model=Event, status_code=201)
async def create_event(
    event: EventCreate,
    current_user: User = Depends(get_admin_user)
):
    """
    Create a new event (admin only).
    """
    try:
        # Get user ID handling both dict and User object (for admin bypass)
        if isinstance(current_user, dict):
            user_id = current_user.get("_id")
            logger.info(f"Using dict user with ID: {user_id}")
        else:
            user_id = current_user.id
            logger.info(f"Using User object with ID: {user_id}")
        
        logger.info(f"Starting event creation for user: {user_id}")
        
        # Use model_dump instead of dict for Pydantic v2 compatibility
        try:
            event_data = event.model_dump()
            logger.info(f"Event data: {event_data}")
        except AttributeError:
            # Fallback for older Pydantic versions
            event_data = event.dict()
            logger.info(f"Event data (using dict): {event_data}")
        
        # Handle admin bypass IDs which are not valid ObjectIds
        if isinstance(user_id, str) and user_id.startswith('admin_bypass_'):
            logger.info(f"Detected admin bypass ID, generating new ObjectId instead of converting")
            user_id = ObjectId()  # Generate a new valid ObjectId
        # Normal user IDs - try to convert if they're strings
        elif isinstance(user_id, str):
            try:
                user_id = ObjectId(user_id)
            except Exception as e:
                logger.error(f"Invalid user ID format: {user_id}, error: {str(e)}")
                raise ValueError(f"Invalid user ID format: {str(e)}")
        
        # Create the event
        created_event = await EventRepository.create_event(event, user_id)
        
        if not created_event:
            logger.error("Event creation returned None")
            raise ValueError("Event creation failed - returned None")
            
        logger.info(f"Event created successfully with ID: {getattr(created_event, 'id', None)}")
        return created_event
        
    except Exception as e:
        detail = f"Failed to create event: {str(e)}"
        logger.error(detail)
        
        # Use try-except for model_dump() or fall back to dict()
        try:
            event_dict = event.model_dump()
            logger.error(f"Event data: {json.dumps(event_dict, default=str)}")
        except AttributeError:
            event_dict = event.dict()
            logger.error(f"Event data (using dict): {json.dumps(event_dict, default=str)}")
            
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        
        # Return a more descriptive error message with safe user_id access
        user_id_str = str(getattr(current_user, 'id', current_user.get('_id', 'unknown')))
        raise HTTPException(
            status_code=500, 
            detail={
                "message": detail,
                "error_type": type(e).__name__,
                "event_data": str(event_dict),
                "user_id": user_id_str
            }
        )

@router.get("/events", response_model=List[Event])
async def get_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user)
):
    """
    Get a list of events.
    """
    try:
        return await EventRepository.get_events(skip, limit, active_only)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")

@router.get("/events/upcoming", response_model=List[Event])
async def get_upcoming_events(
    limit: int = Query(5, ge=1, le=20)
):
    """
    Get upcoming events. Public endpoint.
    """
    return await EventRepository.get_upcoming_events(limit)

@router.get("/events/{event_id}", response_model=Event)
async def get_event(
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific event by ID.
    """
    event = await EventRepository.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.put("/events/{event_id}", response_model=Event)
async def update_event(
    event_update: EventUpdate,
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Update an event (admin only).
    """
    try:
        event = await EventRepository.update_event(event_id, event_update)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")

@router.delete("/events/{event_id}", response_model=bool)
async def delete_event(
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Delete an event (admin only).
    """
    try:
        success = await EventRepository.delete_event(event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        return success
    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")

@router.get("/events/{event_id}/qrcode", response_model=Dict[str, str])
async def generate_event_qr_code(
    event_id: PyObjectId = Path(...),
    type: str = Query("registration", description="Type of QR code: 'registration' or 'attendance'"),
    current_user: User = Depends(get_admin_user)
):
    """
    Generate a QR code for an event (admin only).
    Supported types: 'registration' (default) or 'attendance'
    """
    try:
        event = await EventRepository.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Generate QR code based on type
        if type == "attendance":
            qr_code_url = await EventRepository.generate_attendance_qr_code(event_id)
        else:
            qr_code_url = await EventRepository.generate_event_qr_code(event_id)
        
        return {"qr_code_url": qr_code_url}
    except Exception as e:
        logger.error(f"Failed to generate {type} QR code: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate {type} QR code: {str(e)}"
        )

@router.get("/events/{event_id}/attendance-qrcode", response_model=Dict[str, str])
async def generate_event_attendance_qr_code(
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Generate a QR code for instant attendance marking for an event (admin only).
    """
    try:
        event = await EventRepository.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Generate attendance QR code
        qr_code_url = await EventRepository.generate_attendance_qr_code(event_id)
        
        return {"qr_code_url": qr_code_url}
    except Exception as e:
        logger.error(f"Failed to generate attendance QR code: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate attendance QR code: {str(e)}"
        ) 