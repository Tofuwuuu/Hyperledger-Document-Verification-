"""
Notification Service

This module provides functionality for handling notifications including:
- Storing notifications in the database
- Retrieving user notifications
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

from app.config.database import get_database

logger = logging.getLogger(__name__)

class NotificationTypes:
    """Notification type constants."""
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_VERIFIED = "document_verified"
    DOCUMENT_REJECTED = "document_rejected"
    DOCUMENT_UPDATED = "document_updated"
    BLOCKCHAIN_CONFIRMED = "blockchain_confirmed"
    SYSTEM_NOTIFICATION = "system_notification"
    # New document request notification types
    DOCUMENT_REQUESTED = "document_requested"
    DOCUMENT_REQUEST_APPROVED = "document_request_approved"
    DOCUMENT_REQUEST_REJECTED = "document_request_rejected"
    DOCUMENT_REQUEST_COMPLETED = "document_request_completed"

async def create_notification(
    user_id: str,
    notification_type: str,
    message: str,
    document_id: Optional[str] = None,
    document_title: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None,
    is_read: bool = False,
) -> Dict[str, Any]:
    """
    Create a notification and store it in the database.
    
    Args:
        user_id: ID of the user to notify
        notification_type: Type of notification
        message: Human-readable notification message
        document_id: Optional related document ID
        document_title: Optional document title
        additional_data: Optional additional data to include
        is_read: Whether the notification has been read
        
    Returns:
        The created notification document
    """
    db = get_database()
    
    # Create notification document
    notification = {
        "user_id": user_id,
        "type": notification_type,
        "message": message,
        "created_at": datetime.utcnow(),
        "is_read": is_read,
        "data": additional_data or {}
    }
    
    # Add document info if provided
    if document_id:
        notification["document_id"] = document_id
    if document_title:
        notification["document_title"] = document_title
    
    # Store notification in database
    result = await db.notifications.insert_one(notification)
    notification["_id"] = result.inserted_id
    
    logger.info(f"Created notification for user {user_id}: {notification_type}")
    
    return notification

async def get_user_notifications(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    include_read: bool = False
) -> List[Dict[str, Any]]:
    """
    Get notifications for a user.
    
    Args:
        user_id: ID of the user to get notifications for
        limit: Maximum number of notifications to return
        offset: Number of notifications to skip (for pagination)
        include_read: Whether to include read notifications
        
    Returns:
        List of notification documents
    """
    db = get_database()
    
    # Build query
    query = {"user_id": user_id}
    if not include_read:
        query["is_read"] = False
    
    # Get notifications with pagination
    cursor = db.notifications.find(query)
    cursor = cursor.sort("created_at", -1)  # Most recent first
    cursor = cursor.skip(offset).limit(limit)
    
    notifications = await cursor.to_list(length=limit)
    return notifications

async def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """
    Mark a notification as read.
    
    Args:
        notification_id: ID of the notification to mark as read
        user_id: ID of the user who owns the notification
        
    Returns:
        True if the notification was successfully marked as read, False otherwise
    """
    db = get_database()
    
    # Update notification
    result = await db.notifications.update_one(
        {"_id": notification_id, "user_id": user_id},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    
    return result.modified_count > 0

async def mark_all_notifications_read(user_id: str) -> int:
    """
    Mark all notifications for a user as read.
    
    Args:
        user_id: ID of the user
        
    Returns:
        Number of notifications marked as read
    """
    db = get_database()
    
    # Update all unread notifications for the user
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    
    return result.modified_count

async def count_unread_notifications(user_id: str) -> int:
    """
    Count the number of unread notifications for a user.
    
    Args:
        user_id: ID of the user
        
    Returns:
        Number of unread notifications
    """
    db = get_database()
    
    # Count unread notifications
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    return count

async def delete_notification(notification_id: str, user_id: str) -> bool:
    """
    Delete a notification.
    
    Args:
        notification_id: ID of the notification to delete
        user_id: ID of the user who owns the notification
        
    Returns:
        True if the notification was successfully deleted, False otherwise
    """
    db = get_database()
    
    # Delete notification
    result = await db.notifications.delete_one({
        "_id": notification_id,
        "user_id": user_id
    })
    
    return result.deleted_count > 0

async def notify_document_verification(
    document_id: str,
    document_title: str,
    status: str,
    user_id: str,
    admin_notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Notify a user about a document verification status change.
    
    Args:
        document_id: ID of the document
        document_title: Title of the document
        status: New verification status
        user_id: ID of the user to notify
        admin_notes: Optional notes from admin
        
    Returns:
        The created notification document
    """
    # Determine notification type and message based on status
    if status == "verified":
        notification_type = NotificationTypes.DOCUMENT_VERIFIED
        message = f"Your document '{document_title}' has been verified."
    elif status == "rejected":
        notification_type = NotificationTypes.DOCUMENT_REJECTED
        message = f"Your document '{document_title}' has been rejected."
        if admin_notes:
            message += f" Reason: {admin_notes}"
    else:
        notification_type = NotificationTypes.DOCUMENT_UPDATED
        message = f"Your document '{document_title}' status has been updated to '{status}'."

    # Create additional data
    additional_data = {
        "document_id": document_id,
        "document_title": document_title,
        "status": status
    }
    
    if admin_notes:
        additional_data["admin_notes"] = admin_notes
    
    # Create and send notification
    notification = await create_notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        document_id=document_id,
        document_title=document_title,
        additional_data=additional_data
    )
    
    return notification

async def notify_blockchain_confirmation(
    document_id: str,
    document_title: str,
    user_id: str,
    transaction_id: str
) -> Dict[str, Any]:
    """
    Notify a user when their document has been confirmed on the blockchain.
    
    Args:
        document_id: ID of the document
        document_title: Title of the document
        user_id: ID of the user to notify
        transaction_id: Blockchain transaction ID
        
    Returns:
        The created notification document
    """
    notification_type = NotificationTypes.BLOCKCHAIN_CONFIRMED
    message = f"Your document '{document_title}' has been confirmed on the blockchain."
    
    # Create additional data
    additional_data = {
        "document_id": document_id,
        "document_title": document_title,
        "transaction_id": transaction_id
    }
    
    # Create and send notification
    notification = await create_notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        document_id=document_id,
        document_title=document_title,
        additional_data=additional_data
    )
    
    return notification

async def notify_document_request_created(
    request_id: str,
    document_type: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Notify about a document request being created.
    Notifies both the requesting alumni and admin users.
    
    Args:
        request_id: ID of the document request
        document_type: Type of document requested
        user_id: ID of the user who created the request
        
    Returns:
        The created notification document for the alumni
    """
    db = get_database()
    
    # First, notify the alumni who made the request
    alumni_message = f"Your request for '{document_type}' has been submitted and is pending review."
    
    # Create alumni notification
    alumni_notification = await create_notification(
        user_id=user_id,
        notification_type=NotificationTypes.DOCUMENT_REQUESTED,
        message=alumni_message,
        additional_data={
            "request_id": request_id,
            "document_type": document_type,
            "status": "pending"
        }
    )
    
    try:
        # Get all admin users to notify them about the new request
        admin_users = await db.users.find({"is_admin": True}).to_list(None)
        
        # Get alumni details for a more informative notification
        alumni_info = await db.alumni.find_one({"user_id": user_id})
        alumni_name = "Unknown"
        student_id = "N/A"
        
        if alumni_info:
            alumni_name = alumni_info.get("full_name", "Unknown")
            student_id = alumni_info.get("student_id", "N/A")
            
        admin_message = f"New document request: {document_type} from {alumni_name} ({student_id})"
        
        logger.info(f"Sending admin notifications for document request from {alumni_name}")
        
        # Notify each admin
        for admin in admin_users:
            logger.info(f"Notifying admin {admin.get('email', admin.get('_id'))} about document request")
            await create_notification(
                user_id=str(admin["_id"]),
                notification_type=NotificationTypes.DOCUMENT_REQUESTED,
                message=admin_message,
                additional_data={
                    "request_id": request_id,
                    "document_type": document_type,
                    "alumni_id": user_id,
                    "alumni_name": alumni_name,
                    "student_id": student_id,
                    "status": "pending"
                }
            )
        
    except Exception as e:
        logger.error(f"Failed to send admin notifications for document request: {str(e)}")
    
    return alumni_notification

async def notify_document_request_status_update(
    request_id: str,
    document_type: str,
    alumni_id: str,
    new_status: str,
    admin_notes: Optional[str] = None,
    rejection_reason: Optional[str] = None,
    document_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Notify a user about a document request status update.
    
    Args:
        request_id: ID of the document request
        document_type: Type of document requested
        alumni_id: ID of the alumni user who made the request
        new_status: The new status (approved, rejected, completed)
        admin_notes: Optional notes from admin
        rejection_reason: Optional reason for rejection
        document_id: Optional ID of generated document if completed
        
    Returns:
        The created notification document
    """
    # Determine notification type and message based on status
    if new_status == "approved":
        notification_type = NotificationTypes.DOCUMENT_REQUEST_APPROVED
        message = f"Your request for '{document_type}' has been approved."
        if admin_notes:
            message += f" Notes: {admin_notes}"
    elif new_status == "rejected":
        notification_type = NotificationTypes.DOCUMENT_REQUEST_REJECTED
        message = f"Your request for '{document_type}' has been rejected."
        if rejection_reason:
            message += f" Reason: {rejection_reason}"
        elif admin_notes:
            message += f" Notes: {admin_notes}"
    elif new_status == "completed":
        notification_type = NotificationTypes.DOCUMENT_REQUEST_COMPLETED
        message = f"Your requested '{document_type}' is now available."
    else:
        notification_type = NotificationTypes.SYSTEM_NOTIFICATION
        message = f"Your request for '{document_type}' status has been updated to '{new_status}'."

    # Create additional data
    additional_data = {
        "request_id": request_id,
        "document_type": document_type,
        "status": new_status
    }
    
    if admin_notes:
        additional_data["admin_notes"] = admin_notes
    if rejection_reason:
        additional_data["rejection_reason"] = rejection_reason
    if document_id:
        additional_data["document_id"] = document_id
    
    # Create and send notification
    notification = await create_notification(
        user_id=alumni_id,
        notification_type=notification_type,
        message=message,
        document_id=document_id,
        additional_data=additional_data
    )
    
    return notification 