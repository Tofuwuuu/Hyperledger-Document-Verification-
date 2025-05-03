import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging
import jwt
import os
from fastapi import HTTPException

from app.config.database import get_database
from app.models.meeting import MeetingStatus, MeetingCreate, MeetingUpdate, MeetingInDB
from app.core.config import settings

logger = logging.getLogger(__name__)

# JWT configuration - load from environment or settings
JWT_APP_ID = os.getenv("JITSI_APP_ID", settings.JITSI_APP_ID)
JWT_APP_SECRET = os.getenv("JITSI_APP_SECRET", settings.JITSI_APP_SECRET)
JWT_ISSUER = os.getenv("JITSI_JWT_ISSUER", "alumni_app")
JWT_AUDIENCE = os.getenv("JITSI_JWT_AUDIENCE", "jitsi")
JWT_VALIDITY_HOURS = int(os.getenv("JITSI_JWT_HOURS", "24"))

async def generate_jwt_token(room_name: str, display_name: str, user_id: str, is_host: bool = False, restrictions: dict = None) -> str:
    """Generate a JWT token for secure meeting access"""
    try:
        # Current time for token issuance
        now = datetime.utcnow()
        
        # Set token expiration time
        expiry = now + timedelta(hours=JWT_VALIDITY_HOURS)
        
        # Define participant permissions based on host status
        # Moderators can control lobby and manage participants
        moderator_roles = [
            'moderator'
        ] if is_host else []
        
        # JWT payload according to Jitsi JWT auth spec
        # https://github.com/jitsi/lib-jitsi-meet/blob/master/doc/tokens.md
        payload = {
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "sub": JWT_APP_ID,
            "exp": int(expiry.timestamp()),
            "iat": int(now.timestamp()),
            "nbf": int(now.timestamp()),
            "context": {
                "user": {
                    "id": user_id,
                    "name": display_name,
                    "avatar": "",
                    "email": "",
                    "moderator": is_host
                },
                "features": {
                    "recording": is_host,
                    "livestreaming": is_host,
                    "screen-sharing": True,
                    "lobby-bypass": is_host,  # Hosts bypass the lobby
                    # New feature flags for enhanced security
                    "outbound-call": is_host,
                    "transcription": is_host,
                    "sip-outbound-call": is_host,
                    # Explicitly disable moderation capabilities for non-hosts
                    "kick-participants": is_host,
                    "can-remove-others": is_host,
                    "remote-mute": is_host
                },
                "group": "",
                "room": {
                    "regex": False, # Exact room name match
                    "name": room_name
                }
            },
            "room": room_name,
            "moderator": is_host
        }
        
        # For non-hosts, add additional security restrictions
        if not is_host:
            # Always enforce these restrictions for non-hosts
            payload["context"]["features"]["kick-participants"] = False
            payload["context"]["features"]["can-remove-others"] = False
            payload["context"]["features"]["remote-mute"] = False
            
            # Apply any additional client-requested restrictions
            if restrictions:
                for key, value in restrictions.items():
                    if key in ["disableKick", "disableRemoteMute", "disableModeratorIndicator", 
                               "disablePrivateChat", "disableReactions"]:
                        payload["context"]["features"][key.replace("disable", "").lower()] = not value
        
        # Generate the JWT token
        token = jwt.encode(payload, JWT_APP_SECRET, algorithm="HS256")
        
        # Log token generation - do not log the actual token in production
        logger.info(f"Generated JWT token for user {user_id} in room {room_name} (isHost: {is_host})")
        
        # Return the token as a string
        if isinstance(token, bytes):
            return token.decode('utf-8')
        return token
    except Exception as e:
        logger.error(f"JWT token generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")

async def create_meeting(event_id: str, 
                         title: str, 
                         description: Optional[str], 
                         start_time: datetime, 
                         duration: int,
                         created_by: Optional[str] = None) -> Dict[str, Any]:
    """Create a new Jitsi meeting for an event"""
    try:
        db = get_database()
        meeting_id = str(uuid.uuid4())
        
        # Create a unique room name with higher entropy
        timestamp = datetime.utcnow().timestamp()
        random_suffix = uuid.uuid4().hex[:8]
        room_name = f"alumni-meet-{timestamp}-{random_suffix}"
        
        # Enhanced meeting configuration with reconnection handling
        meeting = {
            "event_id": event_id,
            "title": title,
            "description": description,
            "start_time": start_time,
            "duration": duration,
            "room_name": room_name,
            "created_at": datetime.utcnow(),
            "created_by": created_by,
            "status": MeetingStatus.SCHEDULED,
            "participants": [],
            "config": {
                "members_only": True,
                "require_password": True,
                "enable_lobby": True,
                "auto_record": False,
                "reconnect_attempts": 3
            },
            "recording_info": {
                "enabled": False,
                "recording_url": None,
                "recording_status": None
            }
        }
        
        result = await db.meetings.insert_one(meeting)
        meeting["_id"] = str(result.inserted_id)
        
        logger.info(f"Created meeting {meeting_id} for event {event_id} with room {room_name}")
        return meeting
    except Exception as e:
        logger.error(f"Error creating meeting: {str(e)}")
        raise

async def get_meeting(meeting_id: str) -> Optional[Dict[str, Any]]:
    """Get meeting details by ID"""
    try:
        db = get_database()
        meeting = await db.meetings.find_one({"_id": meeting_id})
        
        if meeting:
            meeting["_id"] = str(meeting["_id"])
            return meeting
        return None
    except Exception as e:
        logger.error(f"Error retrieving meeting {meeting_id}: {str(e)}")
        raise

async def update_meeting(meeting_id: str, update_data: MeetingUpdate) -> Optional[Dict[str, Any]]:
    """Update meeting details"""
    try:
        db = get_database()
        
        # Prepare update data
        update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update the meeting
        result = await db.meetings.update_one(
            {"_id": meeting_id},
            {"$set": update_dict}
        )
        
        if result.modified_count:
            return await get_meeting(meeting_id)
        return None
    except Exception as e:
        logger.error(f"Error updating meeting {meeting_id}: {str(e)}")
        raise

async def get_meetings_by_event(event_id: str) -> List[Dict[str, Any]]:
    """Get all meetings for an event"""
    try:
        db = get_database()
        cursor = db.meetings.find({"event_id": event_id})
        meetings = await cursor.to_list(length=100)
        
        # Convert ObjectId to string
        for meeting in meetings:
            meeting["_id"] = str(meeting["_id"])
            
        return meetings
    except Exception as e:
        logger.error(f"Error retrieving meetings for event {event_id}: {str(e)}")
        raise

async def record_participant_join(meeting_id: str, user_id: str) -> bool:
    """Record when a participant joins a meeting"""
    try:
        db = get_database()
        
        # Check if participant already exists
        meeting = await db.meetings.find_one({"_id": meeting_id})
        if not meeting:
            return False
            
        # Update meeting status to active if it's the first join
        if meeting.get("status") == MeetingStatus.SCHEDULED:
            await db.meetings.update_one(
                {"_id": meeting_id},
                {"$set": {"status": MeetingStatus.ACTIVE}}
            )
        
        # Check if participant is already in the list
        participant_exists = False
        for participant in meeting.get("participants", []):
            if participant.get("user_id") == user_id:
                participant_exists = True
                break
        
        if participant_exists:
            # Update existing participant
            result = await db.meetings.update_one(
                {"_id": meeting_id, "participants.user_id": user_id},
                {"$set": {"participants.$.joined_at": datetime.utcnow(), "participants.$.left_at": None}}
            )
        else:
            # Add new participant
            result = await db.meetings.update_one(
                {"_id": meeting_id},
                {"$push": {"participants": {"user_id": user_id, "joined_at": datetime.utcnow()}}}
            )
        
        return bool(result.modified_count)
    except Exception as e:
        logger.error(f"Error recording participant join for meeting {meeting_id}: {str(e)}")
        raise

async def record_participant_leave(meeting_id: str, user_id: str) -> bool:
    """Record when a participant leaves a meeting"""
    try:
        db = get_database()
        
        result = await db.meetings.update_one(
            {"_id": meeting_id, "participants.user_id": user_id},
            {"$set": {"participants.$.left_at": datetime.utcnow()}}
        )
        
        # Check if all participants have left
        meeting = await db.meetings.find_one({"_id": meeting_id})
        if meeting:
            all_left = True
            for participant in meeting.get("participants", []):
                if not participant.get("left_at"):
                    all_left = False
                    break
            
            # If all participants have left, mark the meeting as completed
            if all_left and len(meeting.get("participants", [])) > 0:
                await db.meetings.update_one(
                    {"_id": meeting_id},
                    {"$set": {"status": MeetingStatus.COMPLETED}}
                )
        
        return bool(result.modified_count)
    except Exception as e:
        logger.error(f"Error recording participant leave for meeting {meeting_id}: {str(e)}")
        raise 