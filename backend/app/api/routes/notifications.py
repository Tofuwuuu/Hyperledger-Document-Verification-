from fastapi import APIRouter, Depends, HTTPException, Query, Path, WebSocket, WebSocketDisconnect, status
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from bson import ObjectId
import logging
import json

from app.utils.auth import get_current_user
from app.services.notification_service import (
    get_user_notifications, 
    mark_notification_read,
    mark_all_notifications_read,
    count_unread_notifications,
    delete_notification
)
from app.config.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Helper function to convert MongoDB documents to JSON-serializable dictionaries
def serialize_doc(doc):
    if doc is None:
        return None
    
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [serialize_doc(item) if isinstance(item, dict) else 
                          str(item) if isinstance(item, ObjectId) else item 
                          for item in value]
        else:
            result[key] = value
    return result

class NotificationResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[Dict[str, Any]]

@router.get("/", response_model=NotificationResponse)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_read: bool = Query(False),
    since_id: Optional[str] = Query(None, description="Get only notifications newer than this ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the current user's notifications.
    
    Args:
        limit: Maximum number of notifications to return
        offset: Number of notifications to skip (for pagination)
        include_read: Whether to include notifications that have been marked as read
        since_id: If provided, only return notifications newer than this ID
    """
    user_id = current_user["_id"]
    
    # Get notifications
    db = get_database()
    
    # Build query
    query = {"user_id": user_id}
    if not include_read:
        query["is_read"] = False
        
    # If since_id is provided, get only newer notifications
    if since_id:
        try:
            # Try to find the notification to get its creation time
            since_notification = await db.notifications.find_one({"_id": ObjectId(since_id)})
            if since_notification:
                # Get notifications created after this one
                query["created_at"] = {"$gt": since_notification["created_at"]}
        except Exception as e:
            logger.error(f"Error processing since_id parameter: {str(e)}")
    
    # Get notifications with pagination
    cursor = db.notifications.find(query)
    cursor = cursor.sort("created_at", -1)  # Most recent first
    cursor = cursor.skip(offset).limit(limit)
    
    notifications = await cursor.to_list(length=limit)
    
    # Serialize MongoDB documents to make them JSON-serializable
    serialized_notifications = [serialize_doc(notification) for notification in notifications]
    
    # Count total unread notifications
    unread_count = await count_unread_notifications(user_id)
    
    return {
        "total": len(serialized_notifications),
        "unread_count": unread_count,
        "notifications": serialized_notifications
    }

@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_read(
    notification_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Mark a notification as read.
    
    Args:
        notification_id: ID of the notification to mark as read
    """
    user_id = current_user["_id"]
    
    # Mark notification as read
    success = await mark_notification_read(notification_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or already read"
        )
    
    return {"success": True}

@router.post("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_read(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark all notifications as read."""
    user_id = current_user["_id"]
    
    # Mark all notifications as read
    count = await mark_all_notifications_read(user_id)
    
    return {"success": True, "count": count}

@router.delete("/{notification_id}", status_code=status.HTTP_200_OK)
async def delete_notification_endpoint(
    notification_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a notification.
    
    Args:
        notification_id: ID of the notification to delete
    """
    user_id = current_user["_id"]
    
    # Delete notification
    success = await delete_notification(notification_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )
    
    return {"success": True}

@router.get("/count", status_code=status.HTTP_200_OK)
async def get_unread_count(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get the count of unread notifications."""
    user_id = current_user["_id"]
    
    # Count unread notifications
    count = await count_unread_notifications(user_id)
    
    return {"count": count} 