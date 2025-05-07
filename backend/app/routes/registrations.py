from typing import List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Path, Response, Query, Request
from bson import ObjectId
import qrcode
import io
import base64
import logging
import json
import traceback

from app.models.registration import Registration, RegistrationCreate, RegistrationUpdate, RegistrationWithUser
from app.models.common import PyObjectId
from app.repositories.registration_repository import RegistrationRepository
from app.repositories.event_repository import EventRepository
from app.utils.auth import get_current_active_user, get_admin_user
from app.models.user import User
from app.config.database import get_database_async
from app.models.student import Student
from app.repositories.student_repository import StudentRepository
from app.models.attendance import AttendanceCreate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/registrations", response_model=Registration)
async def register_for_event(
    registration: RegistrationCreate,
    current_user: Union[User, Dict[str, Any]] = Depends(get_current_active_user)
):
    """
    Register current user for an event.
    """
    # Detailed logging for debugging
    logger.info("=" * 50)
    logger.info(f"REGISTRATION ATTEMPT - Event: {registration.event_id}")
    
    # Handle both User model and dictionary types
    user_id = None
    is_verified = False
    student_id = None
    user_email = None
    
    try:
        if isinstance(current_user, User):
            user_id = current_user.id
            is_verified = current_user.is_verified
            student_id = current_user.student_id
            user_email = current_user.email
            logger.info(f"USER INFO (Model) - ID: {user_id}, Email: {user_email}")
            logger.info(f"USER DETAILS (Model) - Verified: {is_verified}, Student ID: {student_id}")
        else:
            # Dictionary case
            user_id = current_user.get("_id") or current_user.get("id")
            is_verified = current_user.get("is_verified", False)
            student_id = current_user.get("student_id")
            user_email = current_user.get("email")
            logger.info(f"USER INFO (Dict) - ID: {user_id}, Email: {user_email}")
            logger.info(f"USER DETAILS (Dict) - Verified: {is_verified}, Student ID: {student_id}")
        
        # Convert the user data to string for logging, handling both model and dict cases safely
        user_data_str = ""
        try:
            if hasattr(current_user, "dict") and callable(getattr(current_user, "dict")):
                user_data_str = json.dumps(current_user.dict(), default=str)
            else:
                user_data_str = json.dumps(current_user, default=str)
        except Exception as e:
            user_data_str = f"Error serializing user data: {str(e)}"
            
        logger.info(f"USER DATA: {user_data_str}")
        logger.info("=" * 50)
        
        # Check if we have a valid user ID
        if not user_id:
            logger.warning("Registration rejected - Missing user ID")
            raise HTTPException(
                status_code=422,
                detail="User identification is missing. Please try logging out and back in."
            )
        
        # Check if user is verified
        if not is_verified:
            logger.warning(f"Registration rejected - User {user_id} is not verified")
            raise HTTPException(
                status_code=422, 
                detail="Your account is not verified. Please verify your account before registering for events."
            )
        
        # Check if user has a student ID
        if not student_id:
            logger.warning(f"Registration rejected - User {user_id} has no student ID")
            raise HTTPException(
                status_code=422, 
                detail="You must have a student ID in your profile to register for events."
            )
        
        # Ensure the event exists
        event = await EventRepository.get_event(registration.event_id)
        if not event:
            logger.warning(f"Registration rejected - Event {registration.event_id} not found")
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Set the user_id to the current user
        registration.user_id = user_id
        
        # Check if event has reached maximum capacity
        if event.max_attendees and event.registration_count >= event.max_attendees:
            logger.warning(f"Registration rejected - Event {registration.event_id} has reached maximum capacity")
            raise HTTPException(status_code=400, detail="Event has reached maximum capacity")
        
        logger.info(f"Registration approved for event {registration.event_id} by user {user_id}")
        return await RegistrationRepository.create_registration(registration)
    except Exception as e:
        if isinstance(e, HTTPException):
            # Rethrow HTTP exceptions directly
            raise
        
        # Log any other errors
        logger.error(f"Unexpected error in registration process: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed due to an unexpected error: {str(e)}"
        )

@router.get("/registrations/all", response_model=List[Dict[str, Any]])
async def get_all_event_registrations(
    current_user: User = Depends(get_admin_user)
):
    """
    Get all event registrations across all events (admin only).
    """
    try:
        # Handle both User object and dictionary cases for current_user
        user_id = None
        if isinstance(current_user, User):
            user_id = current_user.id
        else:
            # For dictionary case, try both 'id' and '_id'
            user_id = current_user.get("id") or current_user.get("_id") or "admin_bypass"
            
        logger.info(f"Fetching all event registrations for admin user: {user_id}")
        
        # Log database connection attempt
        db = await get_database_async()
        logger.info("Database connection established successfully")
        
        # Check if the collection exists and count documents
        collection_exists = RegistrationRepository.collection_name in await db.list_collection_names()
        if not collection_exists:
            logger.warning(f"Collection '{RegistrationRepository.collection_name}' does not exist in database")
            return []
            
        # Count documents in collection for debugging
        doc_count = await db[RegistrationRepository.collection_name].count_documents({})
        logger.info(f"Total documents in collection: {doc_count}")
        
        # Fetch registrations
        registrations = await RegistrationRepository.get_all_registrations()
        logger.info(f"Retrieved {len(registrations)} total registrations")
        
        # Log detailed summary by status
        status_counts = {}
        for reg in registrations:
            status = reg.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        logger.info(f"Registration status counts: {status_counts}")
        
        # Include some metadata in response for front-end debugging
        if not registrations:
            # Return empty list with metadata for debugging
            return registrations
            
        return registrations
    except Exception as e:
        logger.error(f"Failed to fetch all registrations: {str(e)}", exc_info=True)
        # Include more diagnostic information in the error
        error_message = f"Failed to fetch registrations: {str(e)}"
        
        # Check if this is a database connection error
        if "database" in str(e).lower() or "mongo" in str(e).lower() or "connection" in str(e).lower():
            error_message = "Database connection error. Please check if MongoDB is running properly."
            
        raise HTTPException(status_code=500, detail=error_message)

@router.get("/registrations/user", response_model=List[Dict[str, Any]])
async def get_user_registrations(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all registrations for the current user.
    """
    try:
        # Handle both User object and dictionary cases
        user_id = None
        if isinstance(current_user, User):
            user_id = current_user.id
        else:
            # For dictionary case, try both 'id' and '_id'
            user_id = current_user.get("id") or current_user.get("_id")
            
        if not user_id:
            logger.error("User ID not found in current_user object")
            raise HTTPException(
                status_code=400, 
                detail="User ID not found. Please login again."
            )
            
        logger.info(f"Fetching registrations for user ID: {user_id}")
        registrations = await RegistrationRepository.get_user_registrations(user_id)
        logger.info(f"Retrieved {len(registrations)} registrations for user {user_id}")
        
        if not registrations:
            logger.info(f"No registrations found for user {user_id}")
        
        return registrations
    except Exception as e:
        logger.error(f"Error fetching user registrations: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch registrations: {str(e)}"
        )

@router.get("/registrations/event/{event_id}", response_model=List[RegistrationWithUser])
async def get_event_registrations(
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Get all registrations for a specific event (admin only).
    """
    # Ensure the event exists
    event = await EventRepository.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return await RegistrationRepository.get_event_registrations(event_id)

@router.get("/registrations/event/{event_id}/attendees", response_model=Dict[str, Any])
async def get_event_attendees(
    event_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Get detailed attendance information for all registrants of a specific event (admin only).
    Includes comprehensive user information and attendance status.
    """
    # Ensure the event exists
    event = await EventRepository.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendees = await RegistrationRepository.get_detailed_event_attendees(event_id)
    
    # Calculate attendance statistics
    total = len(attendees)
    attended = sum(1 for a in attendees if a.get("status") == "attended")
    registered = sum(1 for a in attendees if a.get("status") == "registered")
    cancelled = sum(1 for a in attendees if a.get("status") == "cancelled")
    
    # Add statistics to response
    stats = {
        "total": total,
        "attended": attended,
        "registered": registered,
        "cancelled": cancelled,
        "attendance_rate": round((attended / total) * 100, 1) if total > 0 else 0
    }
    
    # Include event details
    event_details = {
        "id": str(event.id),
        "title": event.title,
        "description": event.description,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "location": event.location,
        "max_attendees": event.max_attendees,
        "status": "active" if event.is_active else "inactive"
    }
    
    # Return data with metadata
    return {
        "event": event_details,
        "statistics": stats,
        "attendees": attendees
    }

@router.get("/registrations/{registration_id}", response_model=Registration)
async def get_registration(
    registration_id: PyObjectId = Path(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific registration.
    """
    registration = await RegistrationRepository.get_registration(registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Only allow the registered user or admin to view the registration
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this registration")
    
    return registration

@router.get("/registrations/{registration_id}/qrcode")
async def get_registration_qrcode(
    registration_id: PyObjectId = Path(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get QR code for a registration.
    """
    registration = await RegistrationRepository.get_registration(registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Only allow the registered user or admin to get the QR code
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this QR code")
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(registration.qr_code_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    # Return the image
    return Response(content=img_byte_arr.getvalue(), media_type="image/png")

@router.put("/registrations/{registration_id}", response_model=Registration)
async def update_registration(
    update: RegistrationUpdate,
    registration_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Update a registration status (admin only).
    """
    registration = await RegistrationRepository.update_registration(registration_id, update)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    return registration

@router.post("/registrations/{registration_id}/check-in", response_model=Registration)
async def check_in_user(
    registration_id: PyObjectId = Path(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Check in a user for an event (admin only).
    """
    registration = await RegistrationRepository.check_in_user(registration_id, current_user.id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    return registration

@router.post("/registrations/check-in-by-qr", response_model=Registration)
async def check_in_by_qr(
    qr_code_data: str = Query(...),
    current_user: User = Depends(get_admin_user)
):
    """
    Check in a user using QR code (admin only).
    """
    registration = await RegistrationRepository.get_registration_by_qr(qr_code_data)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    return await RegistrationRepository.check_in_user(registration.id, current_user.id)

@router.delete("/registrations/{registration_id}", response_model=bool)
async def cancel_registration(
    registration_id: PyObjectId = Path(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancel a registration.
    """
    registration = await RegistrationRepository.get_registration(registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Only allow the registered user or admin to cancel
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this registration")
    
    return await RegistrationRepository.delete_registration(registration_id)

@router.post("/registrations/quick-register/{event_id}/{token}", response_model=Registration)
async def quick_register(
    event_id: PyObjectId = Path(...),
    token: str = Path(...),
    current_user: Union[User, Dict[str, Any]] = Depends(get_current_active_user)
):
    """
    Quick registration using QR code.
    """
    try:
        # Get user ID
        user_id = None
        is_verified = False
        student_id = None
        user_email = None
        
        if isinstance(current_user, User):
            user_id = current_user.id
            is_verified = current_user.is_verified
            student_id = current_user.student_id
            user_email = current_user.email
            logger.info(f"QUICK REGISTRATION - User ID: {user_id}, Email: {user_email}")
        else:
            # Dictionary case
            user_id = current_user.get("_id")
            is_verified = current_user.get("is_verified", False)
            student_id = current_user.get("student_id")
            user_email = current_user.get("email")
            logger.info(f"QUICK REGISTRATION - User ID: {user_id}, Email: {user_email}")
        
        # Verify the token matches the one stored with the event
        db = await get_database_async()
        event = await db["events"].find_one({
            "_id": event_id,
            "registration_token": token
        })
        
        if not event:
            logger.warning(f"Quick registration rejected - Invalid token for event {event_id}")
            raise HTTPException(
                status_code=404, 
                detail="Invalid registration link. QR code may be expired or invalid."
            )
        
        # Check if user is verified
        if not is_verified:
            logger.warning(f"Quick registration rejected - User {user_id} is not verified")
            raise HTTPException(
                status_code=422, 
                detail="Your account is not verified. Please verify your account before registering for events."
            )
        
        # Check if user has a student ID
        if not student_id:
            logger.warning(f"Quick registration rejected - User {user_id} has no student ID")
            raise HTTPException(
                status_code=422, 
                detail="You must have a student ID in your profile to register for events."
            )
        
        # Check if event has reached maximum capacity
        if event.get("max_attendees") and event.get("registration_count", 0) >= event.get("max_attendees"):
            logger.warning(f"Quick registration rejected - Event {event_id} has reached maximum capacity")
            raise HTTPException(
                status_code=400, 
                detail="Event has reached maximum capacity"
            )
        
        # Create registration
        registration = RegistrationCreate(
            event_id=event_id,
            user_id=user_id
        )
        
        logger.info(f"Quick registration approved for event {event_id} by user {user_id}")
        return await RegistrationRepository.create_registration(registration)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error in quick registration: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register for event: {str(e)}"
        )

@router.post("/quick-attend/{attendance_token}", response_model=Dict[str, str])
async def quick_attend(attendance_token: str = Path(...)):
    """
    Mark attendance for an event using the attendance token without authentication.
    """
    try:
        # Find the event by attendance token
        event = await EventRepository.get_event_by_attendance_token(attendance_token)
        if not event:
            raise HTTPException(status_code=404, detail="Invalid attendance token")
        
        # Return the event details with the redirect URL for attendance marking
        attendance_url = f"/registration/attend?token={attendance_token}"
        
        return {"redirect_url": attendance_url, "event_name": event.name}
    except Exception as e:
        logger.error(f"Failed to process attendance request: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process attendance request: {str(e)}"
        )

@router.post("/attendance", response_model=Dict[str, str])
async def mark_attendance(
    attendance_data: AttendanceCreate,
    request: Request
):
    """
    Mark attendance for an event with student details.
    """
    try:
        # Validate the attendance token
        event = await EventRepository.get_event_by_attendance_token(attendance_data.event_token)
        if not event:
            raise HTTPException(status_code=404, detail="Invalid attendance token")
        
        # Check if student exists or create a new one
        student = await StudentRepository.get_student_by_email(attendance_data.email)
        if not student:
            # Create a new student
            student = Student(
                name=attendance_data.name,
                email=attendance_data.email,
                mobile=attendance_data.mobile,
                department=attendance_data.department
            )
            student_id = await StudentRepository.create_student(student)
            student.id = student_id
        
        # Check if the student is already registered for the event
        registration = await RegistrationRepository.get_registration_by_student_and_event(
            student.id, event.id
        )
        
        if not registration:
            # If student is not registered, register them first
            registration_data = RegistrationCreate(
                event_id=event.id,
                student_id=student.id,
                registration_status="registered"
            )
            await RegistrationRepository.create_registration(registration_data)
            
            # Get the registration object again
            registration = await RegistrationRepository.get_registration_by_student_and_event(
                student.id, event.id
            )
        
        # Mark attendance if not already attended
        if registration.attendance_status != "attended":
            # Update attendance status
            await RegistrationRepository.update_attendance_status(
                registration.id, "attended"
            )
            
            return {"message": "Attendance marked successfully"}
        else:
            return {"message": "You have already marked your attendance for this event"}
            
    except Exception as e:
        logger.error(f"Failed to mark attendance: {str(e)}")
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to mark attendance: {str(e)}"
        ) 