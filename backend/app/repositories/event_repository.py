from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from bson import ObjectId
from app.config.database import get_database_async
from app.models.event import Event, EventCreate, EventUpdate, EventInDB
import logging
import traceback
import json
import uuid
import qrcode
import io
import base64
from PIL import Image

# Set up logging
logger = logging.getLogger(__name__)

class EventRepository:
    collection_name = "events"
    
    @staticmethod
    async def create_event(event: EventCreate, created_by: Union[str, ObjectId]) -> Event:
        """Create a new event."""
        try:
            logger.info(f"Creating event with data: {json.dumps(event.dict(), default=str)}")
            
            # Get database connection
            db = await get_database_async()
            
            # Ensure created_by is an ObjectId
            if isinstance(created_by, str):
                try:
                    created_by = ObjectId(created_by)
                except Exception as e:
                    logger.error(f"Failed to convert created_by to ObjectId: {str(e)}")
                    raise ValueError(f"Invalid created_by format: {str(e)}")
            
            # Convert event to dict and add additional fields
            event_dict = event.dict()
            
            # Add metadata fields
            now = datetime.utcnow()
            event_dict.update({
                "created_by": created_by,
                "created_at": now,
                "updated_at": now,
                "registration_count": 0
            })
            
            logger.debug(f"Prepared event document: {json.dumps(event_dict, default=str)}")
            
            # Insert new event document
            try:
                result = await db[EventRepository.collection_name].insert_one(event_dict)
                if not result or not result.inserted_id:
                    logger.error("Failed to insert event - no inserted_id returned")
                    raise ValueError("Failed to create event in database - insert operation failed")
                
                logger.info(f"Successfully inserted event with ID: {result.inserted_id}")
                inserted_id = result.inserted_id
            except Exception as e:
                logger.error(f"Database insertion error: {str(e)}", exc_info=True)
                raise ValueError(f"Database error during event creation: {str(e)}")
            
            # Retrieve the inserted document
            try:
                logger.debug(f"Retrieving inserted document with ID: {inserted_id}")
                inserted_doc = await db[EventRepository.collection_name].find_one({"_id": inserted_id})
                
                if not inserted_doc:
                    logger.error(f"Failed to retrieve inserted event with ID {inserted_id}")
                    raise ValueError(f"Failed to retrieve created event with ID {inserted_id}")
                
                logger.info(f"Successfully retrieved event with ID {inserted_id}")
                logger.debug(f"Retrieved document: {json.dumps(inserted_doc, default=str)}")
            except Exception as e:
                logger.error(f"Document retrieval error: {str(e)}", exc_info=True)
                raise ValueError(f"Error retrieving created event: {str(e)}")
            
            # Ensure _id is available in the document
            if "_id" not in inserted_doc:
                inserted_doc["_id"] = inserted_id
                logger.warning("Added missing _id field to retrieved document")
            
            # Ensure ObjectId fields are properly handled
            if not isinstance(inserted_doc["_id"], ObjectId):
                try:
                    inserted_doc["_id"] = ObjectId(inserted_doc["_id"])
                    logger.warning("Converted string _id to ObjectId")
                except Exception as e:
                    logger.error(f"Failed to convert _id to ObjectId: {str(e)}")
            
            # Convert dates to proper format if needed
            for date_field in ['start_date', 'end_date', 'registration_deadline', 'created_at', 'updated_at']:
                if date_field in inserted_doc and not isinstance(inserted_doc[date_field], datetime):
                    try:
                        inserted_doc[date_field] = datetime.fromisoformat(str(inserted_doc[date_field]))
                        logger.debug(f"Converted {date_field} to datetime")
                    except Exception as e:
                        logger.warning(f"Failed to convert {date_field} to datetime: {str(e)}")
            
            # Return as Event model
            try:
                logger.debug("Creating Event object from document")
                event_obj = Event(**inserted_doc)
                logger.info(f"Successfully created Event object with ID: {event_obj.id}")
                return event_obj
            except Exception as e:
                logger.error(f"Failed to create Event object: {str(e)}", exc_info=True)
                logger.error(f"Document that failed: {json.dumps(inserted_doc, default=str)}")
                raise ValueError(f"Failed to create Event object from document: {str(e)}")
                
        except Exception as e:
            logger.error(f"Error creating event: {str(e)}", exc_info=True)
            logger.error(f"Event data: {json.dumps(event.dict() if event else {}, default=str)}")
            logger.error(f"Exception traceback: {traceback.format_exc()}")
            raise ValueError(f"Failed to create event: {str(e)}")
    
    @staticmethod
    async def get_event(event_id: ObjectId) -> Optional[Event]:
        try:
            db = await get_database_async()
            event = await db[EventRepository.collection_name].find_one({"_id": event_id})
            
            if event:
                return Event(**event)
            return None
        except Exception as e:
            logger.error(f"Error getting event by ID {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def get_events(skip: int = 0, limit: int = 100, active_only: bool = False) -> List[Event]:
        try:
            db = await get_database_async()
            query = {"is_active": True} if active_only else {}
            cursor = db[EventRepository.collection_name].find(query).skip(skip).limit(limit).sort("start_date", 1)
            
            events = []
            async for event in cursor:
                events.append(Event(**event))
            
            return events
        except Exception as e:
            logger.error(f"Error fetching events: {str(e)}")
            return []
    
    @staticmethod
    async def get_upcoming_events(limit: int = 5) -> List[Event]:
        try:
            db = await get_database_async()
            now = datetime.utcnow()
            query = {"start_date": {"$gte": now}, "is_active": True}
            cursor = db[EventRepository.collection_name].find(query).limit(limit).sort("start_date", 1)
            
            events = []
            async for event in cursor:
                events.append(Event(**event))
            
            return events
        except Exception as e:
            logger.error(f"Error fetching upcoming events: {str(e)}")
            return []
    
    @staticmethod
    async def update_event(event_id: ObjectId, event_update: EventUpdate) -> Optional[Event]:
        try:
            db = await get_database_async()
            update_data = {k: v for k, v in event_update.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            if update_data:
                await db[EventRepository.collection_name].update_one(
                    {"_id": event_id},
                    {"$set": update_data}
                )
            
            updated_event = await db[EventRepository.collection_name].find_one({"_id": event_id})
            
            if updated_event:
                return Event(**updated_event)
            return None
        except Exception as e:
            logger.error(f"Error updating event {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def delete_event(event_id: ObjectId) -> bool:
        try:
            db = await get_database_async()
            result = await db[EventRepository.collection_name].delete_one({"_id": event_id})
            
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting event {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def increment_registration_count(event_id: ObjectId) -> None:
        try:
            db = await get_database_async()
            await db[EventRepository.collection_name].update_one(
                {"_id": event_id},
                {"$inc": {"registration_count": 1}}
            )
        except Exception as e:
            logger.error(f"Error incrementing registration count for event {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def decrement_registration_count(event_id: ObjectId) -> None:
        try:
            db = await get_database_async()
            await db[EventRepository.collection_name].update_one(
                {"_id": event_id},
                {"$inc": {"registration_count": -1}}
            )
        except Exception as e:
            logger.error(f"Error decrementing registration count for event {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def generate_event_qr_code(event_id: ObjectId, qr_type: str = "registration") -> str:
        """
        Generate a QR code for instant registration or attendance for an event.
        
        Args:
            event_id: The ObjectId of the event
            qr_type: The type of QR code ("registration" or "attendance")
            
        Returns:
            The base64-encoded QR code image
        """
        try:
            db = await get_database_async()
            
            # Determine the token field and QR URL field based on the type
            if qr_type == "attendance":
                token_field = "attendance_token"
                qr_url_field = "attendance_qr_url"
                url_path = "quick-attend"
            else:
                token_field = "registration_token"
                qr_url_field = "qr_code_url"  # Keep original field for backward compatibility
                url_path = "quick-register"
            
            # Generate a secure token
            token = str(uuid.uuid4())
            
            # Create QR data with event ID and token
            from app.core.config import settings
            base_url = settings.FRONTEND_URL
            qr_data = f"{base_url}/{url_path}/{event_id}/{token}"
            
            logger.info(f"Generating QR code with data: {qr_data}")
            
            try:
                # Generate QR code
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=10,
                    border=4,
                )
                qr.add_data(qr_data)
                qr.make(fit=True)
                
                # Create image from QR code
                img = qr.make_image(fill_color="black", back_color="white")
                
                # Convert to base64 string
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                qr_code_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                # Data URI format
                qr_code_data_uri = f"data:image/png;base64,{qr_code_base64}"
                
                # Create the update data with the appropriate field names
                update_data = {
                    token_field: token,
                    qr_url_field: qr_code_data_uri
                }
                
                # Store the token and QR code with the event for verification
                await db[EventRepository.collection_name].update_one(
                    {"_id": event_id},
                    {"$set": update_data}
                )
                
                logger.info(f"Generated {qr_type} QR code for event {event_id}")
                return qr_code_data_uri
            except ImportError as e:
                logger.error(f"QR code generation library error: {e}")
                raise ValueError(f"QR code generation library error: {e}")
            except Exception as e:
                logger.error(f"Error in QR code generation: {e}")
                raise ValueError(f"Error in QR code generation: {e}")
                
        except Exception as e:
            logger.error(f"Error generating {qr_type} QR code for event {event_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ValueError(f"Failed to generate QR code: {str(e)}")
    
    @staticmethod
    async def generate_attendance_qr_code(event_id: ObjectId) -> str:
        """
        Generate a QR code for instant attendance marking for an event.
        
        Args:
            event_id: The ObjectId of the event
            
        Returns:
            The base64-encoded QR code image
        """
        return await EventRepository.generate_event_qr_code(event_id, qr_type="attendance")
        
    @staticmethod
    async def get_event_by_attendance_token(attendance_token: str) -> Optional[Event]:
        """
        Get an event by its attendance token.
        
        Args:
            attendance_token: The attendance token to search for
            
        Returns:
            The event if found, None otherwise
        """
        try:
            db = await get_database_async()
            event_data = await db[EventRepository.collection_name].find_one({"attendance_token": attendance_token})
            
            if event_data:
                return Event(**event_data)
            return None
        except Exception as e:
            logger.error(f"Error getting event by attendance token {attendance_token}: {str(e)}")
            raise 