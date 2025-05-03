from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ParticipantInfo(BaseModel):
    user_id: str
    joined_at: datetime
    left_at: Optional[datetime] = None

class MeetingBase(BaseModel):
    event_id: str
    title: str
    description: Optional[str] = None
    start_time: datetime
    duration: int  # in minutes
    
class MeetingCreate(MeetingBase):
    room_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = {
        "members_only": False,
        "require_password": False,
        "enable_lobby": False
    }
    
class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    duration: Optional[int] = None
    status: Optional[MeetingStatus] = None
    recording_url: Optional[str] = None

class MeetingInDB(MeetingBase):
    id: str = Field(..., alias="_id")
    room_name: str
    created_at: datetime
    created_by: Optional[str] = None
    status: MeetingStatus = MeetingStatus.SCHEDULED
    participants: Optional[List[ParticipantInfo]] = []
    recording_url: Optional[str] = None
    
    class Config:
        populate_by_name = True
        
class MeetingOut(MeetingInDB):
    pass 