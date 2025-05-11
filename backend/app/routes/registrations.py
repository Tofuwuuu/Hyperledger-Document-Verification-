from typing import List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Path, Response, Query, Request
from bson import ObjectId
import qrcode
import io
import base64
import logging
import json
import traceback
from datetime import datetime

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
from app.schemas import EventCreate, RegistrationOut
from app.config.database import get_database
from app.core.auth import get_current_active_user, get_admin_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/registrations", response_model=Dict[str, Any])
async def register_for_event(
    registration: RegistrationCreate,
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Register current user for an event.
    """
    # Detailed logging for debugging
    logger.info("=" * 50)
    logger.info(f"REGISTRATION ATTEMPT - Event: {registration.event_id}")
    
    # Get user information
    user_id = current_user.get("_id") or current_user.get("id")
    is_verified = current_user.get("is_verified", False)
    student_id = current_user.get("student_id")
    user_email = current_user.get("email")
    
    logger.info(f"USER INFO - ID: {user_id}, Email: {user_email}")
    logger.info(f"USER DETAILS - Verified: {is_verified}, Student ID: {student_id}")
        
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
    
    try:
        db = get_database()
        
        # Ensure the event exists
        event = await db.events.find_one({"_id": registration.event_id})
        if not event:
            logger.warning(f"Registration rejected - Event {registration.event_id} not found")
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if the user is already registered for this event
        existing_registration = await db.registrations.find_one({
            "event_id": registration.event_id,
            "user_id": user_id
        })
        
        if existing_registration:
            logger.warning(f"Registration rejected - User {user_id} already registered for event {registration.event_id}")
            raise HTTPException(
                status_code=400, 
                detail="You are already registered for this event"
            )
        
        # Check if event has reached maximum capacity
        if event.get("max_participants") and event.get("participant_count", 0) >= event.get("max_participants"):
            logger.warning(f"Registration rejected - Event {registration.event_id} has reached maximum capacity")
            raise HTTPException(status_code=400, detail="Event has reached maximum capacity")
        
        # Create registration document
        now = datetime.utcnow()
        registration_doc = {
            "_id": str(datetime.now().timestamp()),
            "event_id": registration.event_id,
            "user_id": user_id,
            "registration_date": now,
            "notes": registration.notes,
            "attended": False,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert registration and update event participant count
        await db.registrations.insert_one(registration_doc)
        
        # Update event participant count
        await db.events.update_one(
            {"_id": registration.event_id},
            {"$inc": {"participant_count": 1}}
        )
        
        logger.info(f"Registration successful for event {registration.event_id} by user {user_id}")
        return registration_doc
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
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get all event registrations across all events (admin only).
    """
    try:
        # Get user id
        user_id = current_user.get("id") or current_user.get("_id") or "admin_bypass"
        logger.info(f"Fetching all event registrations for admin user: {user_id}")
        
        # Get database connection
        db = get_database()
        
        # Find all registrations
        registrations = []
        async for reg in db.registrations.find({}):
            registrations.append(reg)
        
        logger.info(f"Retrieved {len(registrations)} total registrations")
        return registrations
    except Exception as e:
        logger.error(f"Failed to fetch all registrations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch registrations: {str(e)}")

@router.get("/registrations/user", response_model=List[Dict[str, Any]])
async def get_user_registrations(
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Get all registrations for the current user.
    """
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        
        db = get_database()
        
        # Find all registrations for this user
        registrations = []
        async for reg in db.registrations.find({"user_id": user_id}):
            # Get event details for each registration
            event = await db.events.find_one({"_id": reg["event_id"]})
            if event:
                reg["event"] = event
            registrations.append(reg)
            
        return registrations
    except Exception as e:
        logger.error(f"Error fetching user registrations: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Could not fetch your registrations: {str(e)}"
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