from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from typing import List, Optional
from datetime import datetime
import logging
from pydantic import BaseModel
from bson import ObjectId

from app.models.meeting import MeetingCreate, MeetingUpdate, MeetingOut, MeetingStatus
from app.services import jitsi_service
from app.utils.auth import get_current_user
from app.utils import recording

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Helper function to convert ObjectId to string (similar to events.py)
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

# New model for token generation
class TokenRequest(BaseModel):
    roomName: str
    displayName: str
    userId: str
    isHost: bool = False

@router.options("/meetings")
async def options_meetings(request: Request, response: Response):
    """
    Handle OPTIONS requests for the meetings endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.options("/meetings/{meeting_id}")
async def options_meeting_detail(request: Request, response: Response, meeting_id: str):
    """
    Handle OPTIONS requests for the meeting detail endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.options("/events/{event_id}/meetings")
async def options_event_meetings(request: Request, response: Response, event_id: str):
    """
    Handle OPTIONS requests for the event meetings endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

@router.options("/meetings/generate-token")
async def options_generate_token(request: Request, response: Response):
    """
    Handle OPTIONS requests for the token generation endpoint
    """
    origin = request.headers.get("origin", "*")
    
    # Set CORS headers
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return {}

# New endpoint for JWT token generation
@router.post("/meetings/generate-token")
async def generate_meeting_token(
    request: Request,
    response: Response,
    token_request: TokenRequest,
    current_user = Depends(get_current_user)
):
    """Generate a JWT token for secure meeting access"""
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        # Verify user has permission to generate a token
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Generate JWT token
        token = await jitsi_service.generate_jwt_token(
            room_name=token_request.roomName,
            display_name=token_request.displayName,
            user_id=token_request.userId,
            is_host=token_request.isHost
        )
        
        return {"token": token}
    except Exception as e:
        logger.error(f"Failed to generate meeting token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate token: {str(e)}"
        )

@router.post("/meetings", response_model=MeetingOut)
async def create_meeting(
    request: Request,
    response: Response,
    meeting_data: MeetingCreate,
    current_user = Depends(get_current_user)
):
    """Create a new meeting"""
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        # Extract user ID with fallback
        user_id = None
        
        # Try both id and _id fields
        if "id" in current_user:
            user_id = current_user["id"]
        elif "_id" in current_user:
            user_id = current_user["_id"]
            
        # Log user object for debugging
        logger.debug(f"Current user object: {current_user}")
        
        if not user_id:
            logger.error(f"User ID not found in current_user object: {current_user}")
            raise ValueError("User ID not found in authentication data")
        
        meeting = await jitsi_service.create_meeting(
            event_id=meeting_data.event_id,
            title=meeting_data.title,
            description=meeting_data.description,
            start_time=meeting_data.start_time,
            duration=meeting_data.duration,
            created_by=str(user_id)  # Ensure it's a string
        )
        
        # Convert any ObjectIds to strings
        meeting = convert_objectid_to_string(meeting)
        
        return meeting
    except Exception as e:
        logger.error(f"Failed to create meeting: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )

@router.get("/meetings/{meeting_id}", response_model=MeetingOut)
async def get_meeting(
    request: Request,
    response: Response,
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Get meeting details by ID"""
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    meeting = await jitsi_service.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # Convert any ObjectIds to strings
    meeting = convert_objectid_to_string(meeting)
    
    return meeting

@router.put("/meetings/{meeting_id}", response_model=MeetingOut)
async def update_meeting(
    request: Request,
    response: Response,
    meeting_id: str,
    update_data: MeetingUpdate,
    current_user = Depends(get_current_user)
):
    """Update meeting details"""
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    meeting = await jitsi_service.update_meeting(meeting_id, update_data)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or update failed"
        )
    
    # Convert any ObjectIds to strings
    meeting = convert_objectid_to_string(meeting)
    
    return meeting

@router.get("/events/{event_id}/meetings", response_model=List[MeetingOut])
async def get_event_meetings(
    request: Request,
    response: Response,
    event_id: str,
    current_user = Depends(get_current_user)
):
    """Get all meetings for an event"""
    # Add CORS headers
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    try:
        meetings = await jitsi_service.get_meetings_by_event(event_id)
        
        # Convert any ObjectIds to strings
        meetings = convert_objectid_to_string(meetings)
        
        return meetings
    except Exception as e:
        logger.error(f"Failed to fetch meetings for event {event_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch meetings: {str(e)}"
        )

@router.post("/meetings/{meeting_id}/join")
async def join_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Record when a user joins a meeting"""
    try:
        # Extract user ID with fallback
        user_id = None
        
        # Try both id and _id fields
        if "id" in current_user:
            user_id = current_user["id"]
        elif "_id" in current_user:
            user_id = current_user["_id"]
            
        if not user_id:
            logger.error(f"User ID not found in current_user object: {current_user}")
            raise ValueError("User ID not found in authentication data")
            
        success = await jitsi_service.record_participant_join(meeting_id, str(user_id))
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        return {"status": "success", "message": "Joined meeting successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to record join: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record join: {str(e)}"
        )

@router.post("/meetings/{meeting_id}/leave")
async def leave_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Record when a user leaves a meeting"""
    try:
        # Extract user ID with fallback
        user_id = None
        
        # Try both id and _id fields
        if "id" in current_user:
            user_id = current_user["id"]
        elif "_id" in current_user:
            user_id = current_user["_id"]
            
        if not user_id:
            logger.error(f"User ID not found in current_user object: {current_user}")
            raise ValueError("User ID not found in authentication data")
            
        success = await jitsi_service.record_participant_leave(meeting_id, str(user_id))
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found or user not in meeting"
            )
        return {"status": "success", "message": "Left meeting successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to record leave: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record leave: {str(e)}"
        )

@router.post("/meetings/{meeting_id}/recording/start")
async def start_meeting_recording(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Start recording a meeting - only available to hosts or admins"""
    try:
        # Verify user is authorized to start recording
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Check if user is host or admin
        user_id = None
        if "id" in current_user:
            user_id = str(current_user["id"])
        elif "_id" in current_user:
            user_id = str(current_user["_id"])
        
        # Get meeting to check ownership and get room name
        meeting = await jitsi_service.get_meeting(meeting_id)
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Check if user is meeting creator or admin
        is_admin = current_user.get("role") == "admin"
        is_creator = meeting.get("created_by") == user_id
        
        if not (is_admin or is_creator):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only meeting hosts or administrators can start recordings"
            )
        
        # Start the recording
        result = await recording.start_recording(meeting_id, meeting.get("room_name"))
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to start recording")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting recording: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start recording: {str(e)}"
        )

@router.post("/meetings/{meeting_id}/recording/stop")
async def stop_meeting_recording(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Stop an in-progress meeting recording"""
    try:
        # Verify user is authorized to stop recording
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Check if user is host or admin
        user_id = None
        if "id" in current_user:
            user_id = str(current_user["id"])
        elif "_id" in current_user:
            user_id = str(current_user["_id"])
        
        # Get meeting to check ownership
        meeting = await jitsi_service.get_meeting(meeting_id)
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Check if user is meeting creator or admin
        is_admin = current_user.get("role") == "admin"
        is_creator = meeting.get("created_by") == user_id
        
        if not (is_admin or is_creator):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only meeting hosts or administrators can stop recordings"
            )
        
        # Stop the recording
        result = await recording.stop_recording(meeting_id)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to stop recording")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping recording: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop recording: {str(e)}"
        )

@router.get("/meetings/{meeting_id}/recording")
async def get_meeting_recording_status(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Get the status and URL of a meeting recording"""
    try:
        # Verify authentication
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Get recording status
        result = await recording.get_recording_status(meeting_id)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to get recording status")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recording status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recording status: {str(e)}"
        ) 