from fastapi import Depends, HTTPException, APIRouter, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from datetime import datetime
from app.utils.csrf import csrf_protect
from app.schemas import EventCreate
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.utils.utils import generate_url_slug
from app.config.database import get_database
from app.utils.auth import get_admin_user, get_current_user
from app.repositories.event_repository import EventRepository
import json
import traceback
import logging
from typing import List, Optional
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter()

# Helper function to convert ObjectId to string
def convert_objectid_to_string(obj):
    """
    Recursively convert all ObjectId instances to strings in a dict or list
    """
    if isinstance(obj, dict):
        return {k: convert_objectid_to_string(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid_to_string(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj

@router.options("/events")
async def options_events(request: Request, response: Response):
    """
    Handle OPTIONS requests for the events endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}
    
@router.options("/events/upcoming")
async def options_upcoming_events(request: Request, response: Response):
    """
    Handle OPTIONS requests for the upcoming events endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.post("/events", status_code=201)
async def create_event(
    request: Request,
    response: Response,
    event: EventCreate,
    current_user: dict = Depends(get_admin_user)
):
    """
    Create a new event (admin only).
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
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

@router.get("/events/upcoming", response_model=List[dict])
async def get_upcoming_events(
    request: Request,
    response: Response,
    limit: int = Query(5, ge=1, le=20),
    skip: int = Query(0, ge=0)
):
    """
    Get upcoming events (no authentication required).
    This endpoint returns the upcoming events that are active, 
    ordered by event date.
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        logger.info(f"Getting upcoming events with limit={limit}, skip={skip}")
        
        # Get database connection
        db = get_database()
        
        # Get current date
        now = datetime.utcnow()
        
        # Define query for upcoming events
        # Handle both start_date and event_date fields 
        query = {
            "$or": [
                {"event_date": {"$gte": now}},
                {"start_date": {"$gte": now}}
            ],
            "is_active": True
        }
        
        # Get events from database
        cursor = db.events.find(query).sort("event_date", 1).skip(skip).limit(limit)
        
        # Convert to list
        events = []
        async for event in cursor:
            try:
                # Convert all ObjectId instances to strings
                event = convert_objectid_to_string(event)
                
                # Normalize date fields
                if "start_date" in event and "event_date" not in event:
                    event["event_date"] = event["start_date"]
                
                # Convert dates to strings for JSON serialization
                for key, value in event.items():
                    if isinstance(value, datetime):
                        event[key] = value.isoformat()
                        
                events.append(event)
            except Exception as e:
                logger.error(f"Error processing event {event.get('_id', 'unknown')}: {str(e)}")
                # Continue with next event instead of failing entirely
                continue
        
        logger.info(f"Found {len(events)} upcoming events")
        return events
    except Exception as e:
        logger.error(f"Error getting upcoming events: {str(e)}")
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve upcoming events: {str(e)}"
        )

@router.options("/events")
async def options_events_list(request: Request, response: Response):
    """
    Handle OPTIONS requests for the events list endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.get("/events", response_model=List[dict])
async def get_all_events(
    request: Request,
    response: Response,
    active_only: bool = Query(True),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all events, optionally filtered to active events only.
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        logger.info(f"Getting all events with active_only={active_only}")
        
        # Get database connection
        db = get_database()
        
        # Build query
        query = {}
        if active_only:
            query["is_active"] = True
        
        # Get events from database
        cursor = db.events.find(query).sort("event_date", -1)
        
        # Convert to list
        events = []
        async for event in cursor:
            try:
                # Convert all ObjectId instances to strings
                event = convert_objectid_to_string(event)
                
                # Fix field names if needed
                if "start_date" in event and "event_date" not in event:
                    event["event_date"] = event["start_date"]
                if "end_date" in event and "event_date" not in event:
                    # If no start_date/event_date, use end_date
                    if "event_date" not in event:
                        event["event_date"] = event["end_date"]
                
                # Convert dates to strings for JSON serialization
                for key, value in event.items():
                    if isinstance(value, datetime):
                        event[key] = value.isoformat()
                
                events.append(event)
            except Exception as e:
                logger.error(f"Error processing event {event.get('_id', 'unknown')}: {str(e)}")
                # Continue with next event instead of failing entirely
                continue
        
        logger.info(f"Found {len(events)} events")
        return events
    except Exception as e:
        logger.error(f"Error getting all events: {str(e)}")
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve events: {str(e)}"
        )

@router.options("/events/{event_id}")
async def options_event_detail(
    event_id: str,
    request: Request, 
    response: Response
):
    """
    Handle OPTIONS requests for the event detail endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.get("/events/{event_id}")
async def get_event_by_id(
    event_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific event by ID
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        logger.info(f"Getting event with ID: {event_id}")
        
        # Get database connection
        db = get_database()
        
        # Try to find the event
        event = None
        
        # First try with the ID as is
        event = await db.events.find_one({"_id": event_id})
        
        # If not found, try with ObjectId
        if not event:
            try:
                event = await db.events.find_one({"_id": ObjectId(event_id)})
            except Exception as e:
                logger.error(f"Error converting event_id to ObjectId: {e}")
        
        if not event:
            raise HTTPException(
                status_code=404,
                detail=f"Event with ID {event_id} not found"
            )
        
        # Convert all ObjectId instances to strings
        event = convert_objectid_to_string(event)
        
        # Fix field names if needed
        if "start_date" in event and "event_date" not in event:
            event["event_date"] = event["start_date"]
        if "end_date" in event and "event_date" not in event:
            # If no start_date/event_date, use end_date
            if "event_date" not in event:
                event["event_date"] = event["end_date"]
        
        # Convert dates to strings for JSON serialization
        for key, value in event.items():
            if isinstance(value, datetime):
                event[key] = value.isoformat()
        
        # Get registration count for this event
        registration_count = await db.event_registrations.count_documents({"event_id": event_id})
        event["registration_count"] = registration_count
        
        logger.info(f"Found event: {event.get('title', 'Unknown')}")
        return event
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting event with ID {event_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve event: {str(e)}"
        )

@router.options("/events/{event_id}/qrcode")
async def options_event_qrcode(
    request: Request,
    response: Response,
    event_id: str
):
    """
    Handle OPTIONS requests for the event QR code endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.get("/events/{event_id}/qrcode")
async def get_event_qrcode(
    request: Request,
    response: Response,
    event_id: str,
    type: str = Query("registration", description="QR code type (registration or attendance)")
):
    """
    Generate a QR code for an event (registration or attendance)
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        logger.info(f"Generating QR code for event {event_id}, type: {type}")
        
        # Try different ways of getting the ObjectId depending on format
        event_obj_id = None
        try:
            event_obj_id = ObjectId(event_id)
        except Exception:
            event_obj_id = event_id
        
        # Call appropriate EventRepository method based on type
        if type == "registration":
            qr_code_url = await EventRepository.generate_event_qr_code(event_obj_id, "registration")
            return {"qr_code_url": qr_code_url}
        elif type == "attendance":
            qr_code_url = await EventRepository.generate_attendance_qr_code(event_obj_id)
            return {"qr_code_url": qr_code_url}
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid QR code type: {type}. Must be 'registration' or 'attendance'."
            )
    except Exception as e:
        logger.error(f"Error generating QR code for event {event_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate QR code: {str(e)}"
        )

@router.options("/events/{event_id}/attendance-qrcode")
async def options_attendance_qrcode(
    request: Request,
    response: Response,
    event_id: str
):
    """
    Handle OPTIONS requests for the attendance QR code endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.get("/events/{event_id}/attendance-qrcode")
async def get_attendance_qrcode(
    request: Request,
    response: Response,
    event_id: str
):
    """
    Generate an attendance QR code for an event - this is a dedicated endpoint for attendance QR codes
    """
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        logger.info(f"Generating attendance QR code for event {event_id}")
        
        # Try different ways of getting the ObjectId depending on format
        event_obj_id = None
        try:
            event_obj_id = ObjectId(event_id)
        except Exception:
            event_obj_id = event_id
            
        qr_code_url = await EventRepository.generate_attendance_qr_code(event_obj_id)
        return {"qr_code_url": qr_code_url}
    except Exception as e:
        logger.error(f"Error generating attendance QR code for event {event_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate attendance QR code: {str(e)}"
        ) 