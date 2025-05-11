from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class EventBase(BaseModel):
    """Base event schema with common fields."""
    title: str = Field(..., description="Event title")
    description: str = Field(..., description="Event description")
    event_date: datetime = Field(..., description="Date and time of the event")
    location: str = Field(..., description="Event location")
    registration_deadline: Optional[datetime] = Field(None, description="Registration deadline")
    max_participants: Optional[int] = Field(None, description="Maximum number of participants allowed")
    is_active: bool = Field(True, description="Whether the event is active")
    event_type: str = Field(..., description="Type of event (e.g., workshop, seminar, reunion)")
    registration_url: Optional[str] = Field(None, description="URL for external registration")
    
class EventCreate(EventBase):
    """Schema for creating a new event."""
    image_url: Optional[str] = Field(None, description="URL for event image")
    tags: Optional[List[str]] = Field(default=[], description="Event tags for categorization")
    
class EventUpdate(BaseModel):
    """Schema for updating an event."""
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    location: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None
    event_type: Optional[str] = None
    registration_url: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None

class EventInDB(EventBase):
    """Schema for event as stored in the database."""
    id: str = Field(..., alias="_id")
    creator_id: str
    created_at: datetime
    updated_at: datetime
    image_url: Optional[str] = None
    tags: List[str] = []
    slug: str
    participant_count: int = 0
    
    class Config:
        orm_mode = True
        allow_population_by_field_name = True
        
class EventOut(EventInDB):
    """Schema for event output (response)."""
    pass
    
class EventSearchParams(BaseModel):
    """Schema for searching events."""
    query: Optional[str] = None
    event_type: Optional[str] = None
    upcoming_only: bool = True
    tags: Optional[List[str]] = None
    page: int = 1
    limit: int = 10
    
class EventSearchResult(BaseModel):
    """Schema for event search results."""
    results: List[EventOut]
    total: int
    page: int
    limit: int
    
class RegistrationCreate(BaseModel):
    """Schema for creating an event registration."""
    event_id: str
    notes: Optional[str] = None
    
class RegistrationOut(BaseModel):
    """Schema for event registration output."""
    id: str = Field(..., alias="_id")
    event_id: str
    user_id: str
    registration_date: datetime
    notes: Optional[str] = None
    attended: bool = False
    
    class Config:
        orm_mode = True
        allow_population_by_field_name = True 