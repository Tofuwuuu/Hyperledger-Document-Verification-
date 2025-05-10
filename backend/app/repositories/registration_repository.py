from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid
from bson import ObjectId
from app.config.database import get_database, get_database_async, get_transaction_session
from app.models.registration import Registration, RegistrationCreate, RegistrationUpdate, RegistrationWithUser
from app.repositories.event_repository import EventRepository
from app.utils.json_utils import serialize_mongodb_doc
import logging
from fastapi import HTTPException

# Set up logging
logger = logging.getLogger(__name__)

class RegistrationRepository:
    collection_name = "event_registrations"
    
    @staticmethod
    async def create_registration(registration: RegistrationCreate) -> Registration:
        try:
            db = await get_database_async()
            
            # Ensure ObjectId for IDs
            event_id = registration.event_id
            user_id = registration.user_id
            
            # Convert IDs to ObjectId if they're strings
            if isinstance(event_id, str):
                event_id = ObjectId(event_id)
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            
            # Check if user is already registered for this event
            existing = await db[RegistrationRepository.collection_name].find_one({
                "event_id": event_id,
                "user_id": user_id
            })
            
            if existing:
                # User is already registered, return the existing registration
                logger.info(f"User {user_id} is already registered for event {event_id}")
                return Registration(**existing)
            
            registration_data = registration.dict()
            
            # Ensure ObjectId is used for MongoDB
            registration_data["event_id"] = event_id
            registration_data["user_id"] = user_id
            registration_data["registration_date"] = datetime.utcnow()
            
            # Generate a unique QR code data (UUID + event_id + user_id)
            qr_uuid = str(uuid.uuid4())
            registration_data["qr_code_data"] = f"{qr_uuid}-{event_id}-{user_id}"
            
            logger.info(f"Creating registration with data: {registration_data}")
            
            # Use a transaction to ensure that both operations succeed or fail together
            async with get_transaction_session() as session:
                async with session.start_transaction():
                    # Insert registration within transaction
                    result = await db[RegistrationRepository.collection_name].insert_one(
                        registration_data, 
                        session=session
                    )
                    logger.info(f"Registration created with ID: {result.inserted_id}")
                    
                    # Increment the registration count for the event within the same transaction
                    await db.events.update_one(
                        {"_id": event_id},
                        {"$inc": {"registration_count": 1}},
                        session=session
                    )
                    logger.info(f"Event {event_id} registration count incremented")
            
            # Transaction committed at this point if successful
            
            created_registration = await db[RegistrationRepository.collection_name].find_one({"_id": result.inserted_id})
            
            if not created_registration:
                logger.error(f"Failed to retrieve created registration with ID {result.inserted_id}")
                raise ValueError("Registration was created but could not be retrieved")
                
            logger.info(f"Retrieved created registration: {created_registration}")
            return Registration(**created_registration)
        except Exception as e:
            logger.error(f"Error creating registration: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create registration: {str(e)}")
    
    @staticmethod
    async def get_registration(registration_id: ObjectId) -> Optional[Registration]:
        db = await get_database_async()
        registration = await db[RegistrationRepository.collection_name].find_one({"_id": registration_id})
        
        if registration:
            return Registration(**registration)
        return None
    
    @staticmethod
    async def get_registration_by_qr(qr_code_data: str) -> Optional[Registration]:
        db = await get_database_async()
        registration = await db[RegistrationRepository.collection_name].find_one({"qr_code_data": qr_code_data})
        
        if registration:
            return Registration(**registration)
        return None
    
    @staticmethod
    async def get_all_registrations() -> List[Dict[str, Any]]:
        try:
            db = await get_database_async()
            cursor = db[RegistrationRepository.collection_name].find({})
            
            # Get a count of registrations for logging
            count = await db[RegistrationRepository.collection_name].count_documents({})
            logger.info(f"Found {count} registrations in database")
            
            registrations = []
            async for reg in cursor:
                try:
                    # Get the event details
                    event = await db["events"].find_one({"_id": reg["event_id"]})
                    
                    # Get the user details - handle both string and ObjectId user_ids
                    user = None
                    user_id = reg.get("user_id")
                    if user_id:
                        # Convert string to ObjectId if needed
                        if isinstance(user_id, str):
                            try:
                                user_id_obj = ObjectId(user_id)
                                user = await db["users"].find_one({"_id": user_id_obj})
                            except:
                                # Try direct string lookup
                                user = await db["users"].find_one({"_id": user_id})
                        else:
                            # Try with the ID as is
                            user = await db["users"].find_one({"_id": user_id})
                            
                        # If user still not found, try with string conversion
                        if not user:
                            user = await db["users"].find_one({"_id": str(user_id)})
                            
                        # If still not found, try by email
                        if not user and "user_email" in reg:
                            user = await db["users"].find_one({"email": reg["user_email"]})
                    
                    # Serialize the registration document to handle ObjectId
                    serialized_reg = serialize_mongodb_doc(reg)
                    
                    # Add event details (even if event is not found)
                    if event:
                        serialized_reg.update({
                            "event_title": event.get("title", "Unknown Event"),
                            "event_date": event.get("start_date", ""),
                            "event_location": event.get("location", "")
                        })
                    else:
                        logger.warning(f"Event not found for registration {reg.get('_id')}, event_id: {reg.get('event_id')}")
                        serialized_reg.update({
                            "event_title": "Unknown Event",
                            "event_date": "",
                            "event_location": ""
                        })
                    
                    # Add user details (even if user is not found)
                    if user:
                        # Try different name fields
                        full_name = user.get("full_name", "")
                        if not full_name and (user.get("first_name") or user.get("last_name")):
                            full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        
                        # Use student_id if available
                        student_id = user.get("student_id", "")
                        
                        serialized_reg.update({
                            "user_name": full_name or "Unknown User",
                            "user_email": user.get("email", ""),
                            "user_student_id": student_id
                        })
                    else:
                        logger.warning(f"User not found for registration {reg.get('_id')}, user_id: {reg.get('user_id')}")
                        serialized_reg.update({
                            "user_name": "Unknown User",
                            "user_email": "",
                            "user_student_id": ""
                        })
                    
                    # Ensure required fields are present with defaults
                    if "status" not in serialized_reg or not serialized_reg["status"]:
                        serialized_reg["status"] = "registered"
                    
                    # Add registration date if missing
                    if "registration_date" not in serialized_reg or not serialized_reg["registration_date"]:
                        # Try to use created_at, or default to current date
                        serialized_reg["registration_date"] = serialized_reg.get("created_at", datetime.utcnow())
                    
                    registrations.append(serialized_reg)
                except Exception as e:
                    logger.error(f"Error processing registration {reg.get('_id')}: {str(e)}")
                    # Still include registration even if we can't get all details
                    # But ensure it's serialized properly with minimum required fields
                    serialized_reg = serialize_mongodb_doc(reg)
                    serialized_reg.update({
                        "event_title": "Error: Unable to load event",
                        "user_name": "Error: Unable to load user",
                        "user_email": "",
                        "user_student_id": "",
                        "status": serialized_reg.get("status", "registered")
                    })
                    registrations.append(serialized_reg)
            
            logger.info(f"Returning {len(registrations)} registrations after serialization")
            return registrations
        except Exception as e:
            logger.error(f"Error fetching all registrations: {str(e)}", exc_info=True)
            # Return empty list on error
            return []
    
    @staticmethod
    async def get_user_registrations(user_id: ObjectId) -> List[Dict[str, Any]]:
        db = await get_database_async()
        cursor = db[RegistrationRepository.collection_name].find({"user_id": user_id})
        
        registrations = []
        async for reg in cursor:
            try:
                # Get the event details
                event = await db["events"].find_one({"_id": reg["event_id"]})
                if event:
                    # Serialize the registration document to handle ObjectId
                    serialized_reg = serialize_mongodb_doc(reg)
                    
                    # Add event details
                    serialized_reg.update({
                        "event_title": event.get("title", ""),
                        "event_date": event.get("start_date", ""),
                        "event_location": event.get("location", "")
                    })
                    registrations.append(serialized_reg)
            except Exception as e:
                logger.error(f"Error processing user registration {reg.get('_id')}: {str(e)}")
                # Still include registration but without event details
                # Make sure it's serialized
                registrations.append(serialize_mongodb_doc(reg))
        
        logger.info(f"Returning {len(registrations)} user registrations after serialization")
        return registrations
    
    @staticmethod
    async def get_event_registrations(event_id: ObjectId) -> List[RegistrationWithUser]:
        db = await get_database_async()
        cursor = db[RegistrationRepository.collection_name].find({"event_id": event_id})
        
        registrations = []
        async for reg in cursor:
            try:
                # Get the user details
                user = await db["users"].find_one({"_id": reg["user_id"]})
                if user:
                    # Convert ObjectId to string for serialization
                    serialized_reg = serialize_mongodb_doc(reg)
                    
                    # Add user details
                    serialized_reg.update({
                        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
                        "user_email": user.get("email", "")
                    })
                    
                    registrations.append(RegistrationWithUser(**serialized_reg))
            except Exception as e:
                logger.error(f"Error processing event registration {reg.get('_id')}: {str(e)}")
                # Skip registrations that can't be processed
        
        logger.info(f"Returning {len(registrations)} event registrations after serialization")
        return registrations
    
    @staticmethod
    async def get_detailed_event_attendees(event_id: ObjectId) -> List[Dict[str, Any]]:
        """
        Get detailed attendance information for all registrants of a specific event.
        
        Args:
            event_id: The event ID
            
        Returns:
            List of detailed attendance records with user information
        """
        try:
            db = await get_database_async()
            
            # First get the event details
            event = await db["events"].find_one({"_id": event_id})
            if not event:
                logger.warning(f"Event not found for ID: {event_id}")
                return []
                
            # Get all registrations for this event
            cursor = db[RegistrationRepository.collection_name].find({"event_id": event_id})
            
            detailed_attendees = []
            async for reg in cursor:
                try:
                    # Get the user details - handle both string and ObjectId user_ids
                    user = None
                    user_id = reg.get("user_id")
                    
                    if user_id:
                        # Convert string to ObjectId if needed
                        if isinstance(user_id, str):
                            try:
                                user_id_obj = ObjectId(user_id)
                                user = await db["users"].find_one({"_id": user_id_obj})
                            except:
                                # Try direct string lookup
                                user = await db["users"].find_one({"_id": user_id})
                        else:
                            # Try with the ID as is
                            user = await db["users"].find_one({"_id": user_id})
                            
                        # If user still not found, try with string conversion
                        if not user:
                            user = await db["users"].find_one({"_id": str(user_id)})
                            
                        # If still not found, try by email
                        if not user and "user_email" in reg:
                            user = await db["users"].find_one({"email": reg["user_email"]})
                    
                    # Serialize the registration document
                    serialized_reg = serialize_mongodb_doc(reg)
                    
                    # Set default status if not present
                    if "status" not in serialized_reg or not serialized_reg["status"]:
                        serialized_reg["status"] = "registered"
                    
                    # Extract and format registration date
                    registration_date = serialized_reg.get("registration_date", serialized_reg.get("created_at"))
                    if registration_date:
                        serialized_reg["registration_date_formatted"] = registration_date.strftime("%Y-%m-%d %H:%M:%S")
                    
                    # Extract and format check-in time if present
                    check_in_time = serialized_reg.get("check_in_time")
                    if check_in_time:
                        serialized_reg["check_in_time_formatted"] = check_in_time.strftime("%Y-%m-%d %H:%M:%S")
                    
                    # Add user details if found
                    if user:
                        # Build full name from different possible fields
                        full_name = user.get("full_name", "")
                        if not full_name and (user.get("first_name") or user.get("last_name")):
                            full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        
                        # Get additional user information
                        student_id = user.get("student_id", "")
                        email = user.get("email", "")
                        department = user.get("department", "")
                        year_level = user.get("year_level", "")
                        
                        # Add user details to registration record
                        serialized_reg.update({
                            "user_name": full_name or "Unknown User",
                            "user_email": email,
                            "user_student_id": student_id,
                            "user_department": department,
                            "user_year_level": year_level,
                            "user_profile_pic": user.get("profile_pic", "")
                        })
                    else:
                        # Use placeholder values if user not found
                        serialized_reg.update({
                            "user_name": "Unknown User",
                            "user_email": "",
                            "user_student_id": "",
                            "user_department": "",
                            "user_year_level": "",
                            "user_profile_pic": ""
                        })
                    
                    # Add event details
                    serialized_reg.update({
                        "event_title": event.get("title", "Unknown Event"),
                        "event_date": event.get("start_date", ""),
                        "event_location": event.get("location", ""),
                        "event_max_attendees": event.get("max_attendees", 0)
                    })
                    
                    detailed_attendees.append(serialized_reg)
                    
                except Exception as e:
                    logger.error(f"Error processing event attendee {reg.get('_id')}: {str(e)}")
                    # Include basic record even if processing failed
                    serialized_reg = serialize_mongodb_doc(reg)
                    serialized_reg.update({
                        "user_name": "Error Processing User",
                        "user_email": "",
                        "error": str(e)
                    })
                    detailed_attendees.append(serialized_reg)
            
            logger.info(f"Retrieved {len(detailed_attendees)} detailed attendee records for event {event_id}")
            return detailed_attendees
            
        except Exception as e:
            logger.error(f"Error getting detailed event attendees for event {event_id}: {str(e)}", exc_info=True)
            return []
    
    @staticmethod
    async def update_registration(registration_id: ObjectId, update: RegistrationUpdate) -> Optional[Registration]:
        db = await get_database_async()
        update_data = {k: v for k, v in update.dict().items() if v is not None}
        
        if update_data:
            await db[RegistrationRepository.collection_name].update_one(
                {"_id": registration_id},
                {"$set": update_data}
            )
        
        updated_registration = await db[RegistrationRepository.collection_name].find_one({"_id": registration_id})
        
        if updated_registration:
            return Registration(**updated_registration)
        return None
    
    @staticmethod
    async def check_in_user(registration_id: ObjectId, admin_id: ObjectId) -> Optional[Registration]:
        update = RegistrationUpdate(
            status="attended",
            check_in_time=datetime.utcnow(),
            check_in_by=admin_id
        )
        return await RegistrationRepository.update_registration(registration_id, update)
    
    @staticmethod
    async def delete_registration(registration_id: ObjectId) -> bool:
        try:
            db = await get_database_async()
            
            # Get the registration first to get the event_id for decrementing count
            registration = await db[RegistrationRepository.collection_name].find_one({"_id": registration_id})
            
            if not registration:
                return False
                
            result = await db[RegistrationRepository.collection_name].delete_one({"_id": registration_id})
            
            if result.deleted_count > 0:
                # Decrement the registration count for the event
                event_id = registration.get("event_id")
                if event_id:
                    await EventRepository.decrement_registration_count(event_id)
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error deleting registration {registration_id}: {str(e)}")
            raise
    
    @staticmethod
    async def get_registration_by_student_and_event(student_id: ObjectId, event_id: ObjectId) -> Optional[Registration]:
        """
        Get a registration by student ID and event ID.
        
        Args:
            student_id: The student ID
            event_id: The event ID
            
        Returns:
            The registration if found, None otherwise
        """
        try:
            db = await get_database_async()
            registration = await db[RegistrationRepository.collection_name].find_one({
                "student_id": student_id,
                "event_id": event_id
            })
            
            if registration:
                return Registration(**registration)
            return None
        except Exception as e:
            logger.error(f"Error getting registration by student {student_id} and event {event_id}: {str(e)}")
            raise
    
    @staticmethod
    async def update_attendance_status(registration_id: ObjectId, status: str) -> Optional[Registration]:
        """
        Update the attendance status of a registration.
        
        Args:
            registration_id: The registration ID
            status: The new attendance status (e.g., 'attended')
            
        Returns:
            The updated registration if found, None otherwise
        """
        try:
            db = await get_database_async()
            
            update_data = {
                "attendance_status": status,
                "attendance_time": datetime.utcnow()
            }
            
            await db[RegistrationRepository.collection_name].update_one(
                {"_id": registration_id},
                {"$set": update_data}
            )
            
            updated_registration = await db[RegistrationRepository.collection_name].find_one({"_id": registration_id})
            
            if updated_registration:
                return Registration(**updated_registration)
            return None
        except Exception as e:
            logger.error(f"Error updating attendance status for registration {registration_id}: {str(e)}")
            raise 