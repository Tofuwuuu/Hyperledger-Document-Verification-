from datetime import datetime
from typing import List, Optional, Dict, Any, Union

from pydantic import BaseModel, Field, validator
from bson import ObjectId

from app.models.common import PyObjectId


class EventBase(BaseModel):
    """Base model with common fields for Event."""
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    start_date: datetime
    end_date: Optional[datetime] = None
    location: str
    image_url: Optional[str] = None
    registration_url: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True
    max_attendees: Optional[int] = None
    registration_deadline: Optional[datetime] = None
    requires_approval: bool = False
    
    # Registration QR code fields
    registration_token: Optional[str] = None
    qr_code_url: Optional[str] = None  # For backward compatibility
    
    # Attendance QR code fields
    attendance_token: Optional[str] = None
    attendance_qr_url: Optional[str] = None

    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        if v and 'start_date' in values and values['start_date'] and v < values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class EventCreate(EventBase):
    """Model for creating a new event."""
    tags: Optional[List[str]] = []
    cover_image: Optional[str] = None
    registration_fields: Optional[List[Dict[str, Any]]] = []
    
    model_config = {
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }


class EventUpdate(BaseModel):
    """Model for updating an existing event."""
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    registration_url: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    max_attendees: Optional[int] = None
    registration_deadline: Optional[datetime] = None
    requires_approval: Optional[bool] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    registration_fields: Optional[List[Dict[str, Any]]] = None
    
    model_config = {
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }


class EventInDB(EventBase):
    """Base model for events in the database."""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_by: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    registration_count: int = 0

    model_config = {
        "allow_population_by_field_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }
        
    def dict(self, **kwargs):
        """Custom dict method that handles ObjectIds properly."""
        exclude_none = kwargs.get('exclude_none', False)
        by_alias = kwargs.get('by_alias', False)
        
        # Get dictionary from parent method
        doc = super().dict(**kwargs)
        
        # Convert _id to string if it exists
        if "_id" in doc and doc["_id"] is not None:
            doc["_id"] = str(doc["_id"])
            
        # Also convert id to string if it exists
        if "id" in doc and doc["id"] is not None:
            doc["id"] = str(doc["id"])
            
        # Convert created_by to string
        if "created_by" in doc and doc["created_by"] is not None:
            doc["created_by"] = str(doc["created_by"])
            
        # Filter out None values if exclude_none is True
        if exclude_none:
            return {k: v for k, v in doc.items() if v is not None}
            
        return doc


class Event(EventInDB):
    """Model for reading events. Inherits all fields and methods from EventInDB."""
    
    model_config = {
        "allow_population_by_field_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }
    
    # Explicitly inherit dict method from parent class
    def dict(self, **kwargs):
        """Ensures the dict method from EventInDB is used"""
        return super().dict(**kwargs)
    
    @classmethod
    def from_db(cls, db_event: Dict[str, Any]) -> "Event":
        """Create an Event model from a database document"""
        # Ensure _id is present and correctly formatted
        if "_id" in db_event and db_event["_id"] is not None:
            if not isinstance(db_event["_id"], ObjectId):
                db_event["_id"] = ObjectId(str(db_event["_id"]))
                
        # Ensure created_by is correctly formatted
        if "created_by" in db_event and db_event["created_by"] is not None:
            if not isinstance(db_event["created_by"], ObjectId):
                db_event["created_by"] = ObjectId(str(db_event["created_by"]))
                
        # Create Event object
        return cls(**db_event)
    
    @staticmethod
    def from_mongo(mongo_doc: Dict[str, Any]) -> "Event":
        """
        Create an Event model from a MongoDB document, bypassing Pydantic validation
        to avoid Pydantic v2 compatibility issues.
        """
        # Create a copy to avoid modifying the original
        doc = dict(mongo_doc)
        
        # Ensure all required fields are present
        required_fields = [
            "title", "description", "start_date", "location", "is_active", 
            "_id", "created_by", "created_at", "updated_at", "registration_count"
        ]
        
        # Initialize with default values if missing
        for field in required_fields:
            if field not in doc:
                if field == "_id":
                    doc["_id"] = ObjectId()
                elif field in ["created_at", "updated_at"]:
                    doc[field] = datetime.utcnow()
                elif field == "created_by":
                    doc[field] = ObjectId()
                elif field == "registration_count":
                    doc[field] = 0
                elif field == "is_active":
                    doc[field] = True
                else:
                    doc[field] = ""  # Default string value for other required fields
        
        # Convert ObjectId fields
        doc["id"] = PyObjectId(doc["_id"])
        
        # Ensure datetime fields
        date_fields = ['start_date', 'end_date', 'registration_deadline', 'created_at', 'updated_at']
        for field in date_fields:
            if field in doc and doc[field] is not None:
                if not isinstance(doc[field], datetime):
                    try:
                        doc[field] = datetime.fromisoformat(str(doc[field]))
                    except Exception:
                        # If conversion fails, set to current time if this is a required date field
                        if field in ["created_at", "updated_at", "start_date"]:
                            doc[field] = datetime.utcnow()
        
        # For compatibility with Pydantic v2, create an Event object properly
        # Use the simplest approach - create a dictionary with all the fields
        event_dict = {
            "title": doc.get("title", ""),
            "description": doc.get("description", ""),
            "start_date": doc.get("start_date", datetime.utcnow()),
            "end_date": doc.get("end_date"),
            "location": doc.get("location", ""),
            "image_url": doc.get("image_url"),
            "registration_url": doc.get("registration_url"),
            "category": doc.get("category"),
            "department": doc.get("department"),
            "is_active": doc.get("is_active", True),
            "max_attendees": doc.get("max_attendees"),
            "registration_deadline": doc.get("registration_deadline"),
            "requires_approval": doc.get("requires_approval", False),
            "registration_token": doc.get("registration_token"),
            "qr_code_url": doc.get("qr_code_url"),
            "attendance_token": doc.get("attendance_token"),
            "attendance_qr_url": doc.get("attendance_qr_url"),
            "id": doc.get("id", PyObjectId()),
            "created_by": doc.get("created_by", ObjectId()),
            "created_at": doc.get("created_at", datetime.utcnow()),
            "updated_at": doc.get("updated_at", datetime.utcnow()),
            "registration_count": doc.get("registration_count", 0),
            "tags": doc.get("tags", []),
            "cover_image": doc.get("cover_image"),
            "registration_fields": doc.get("registration_fields", [])
        }
        
        # Create new Event
        try:
            # Create a regular dict with all fields from our processed document
            return Event(**event_dict)
        except Exception as e:
            # Fallback to the __new__ approach if **event_dict fails
            instance = Event.__new__(Event)
            
            # Set the public attributes
            for key, value in event_dict.items():
                setattr(instance, key, value)
                
            # Also set _id attribute specifically
            if "_id" in doc:
                setattr(instance, "_id", doc["_id"])
                
            return instance


class EventResponse(BaseModel):
    """Model for returning event data in API responses."""
    id: str
    title: str
    description: str
    start_date: datetime
    end_date: datetime
    location: str
    max_participants: Optional[int]
    is_active: bool
    is_public: bool
    registration_required: bool
    tags: List[str]
    cover_image: Optional[str]
    created_at: datetime
    updated_at: datetime
    participants: List[str]
    registration_fields: List[Dict[str, Any]]
    organizer_id: str
    
    model_config = {
        "orm_mode": True,
        "json_encoders": {ObjectId: str, PyObjectId: str}
    }
        
    @classmethod
    def from_mongo(cls, data: dict) -> "EventResponse":
        """
        Convert MongoDB document to EventResponse model.
        Handles ObjectId to string conversion explicitly.
        """
        if not data:
            return None
            
        data_copy = dict(data)
        # Convert _id to id string
        if "_id" in data_copy:
            data_copy["id"] = str(data_copy.pop("_id"))
            
        # Convert other potential ObjectId fields to strings
        if "organizer_id" in data_copy and isinstance(data_copy["organizer_id"], ObjectId):
            data_copy["organizer_id"] = str(data_copy["organizer_id"])
            
        # Convert participants ObjectIds to strings if needed
        if "participants" in data_copy:
            data_copy["participants"] = [
                str(p) if isinstance(p, ObjectId) else p 
                for p in data_copy["participants"]
            ]
            
        return cls(**data_copy) 