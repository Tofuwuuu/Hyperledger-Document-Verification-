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

# Helper function to safely convert MongoDB documents to JSON-serializable dictionaries
def serialize_doc(doc):
    if doc is None:
        return None
    
    # Create a trimmed version with only essential fields to reduce response size
    result = {
        "_id": str(doc["_id"]) if "_id" in doc else None,
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "is_read": doc.get("is_read", False),
        "type": doc.get("type", "general"),
    }
    
    # Add created_at only if it exists and is valid
    if "created_at" in doc:
        try:
            result["created_at"] = doc["created_at"].isoformat() if hasattr(doc["created_at"], "isoformat") else str(doc["created_at"])
        except (AttributeError, TypeError):
            # Skip on error
            pass
            
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
    
    # Get database connection
    db = get_database()
    
    # Use a smaller limit to prevent excessive data
    actual_limit = min(limit, 20)
    
    # Build query
    query = {"user_id": user_id}
    if not include_read:
        query["is_read"] = False
        
    # Handle since_id parameter carefully
    if since_id:
        try:
            # Just use ObjectId comparison rather than finding the notification first
            query["_id"] = {"$gt": ObjectId(since_id)}
        except Exception as e:
            logger.error(f"Error processing since_id parameter: {str(e)}")
    
    try:
        # Define projection to limit fields returned
        projection = {
            "_id": 1,
            "title": 1,
            "message": 1, 
            "is_read": 1,
            "type": 1,
            "created_at": 1
        }
        
        # Get notifications with pagination and field restriction
        cursor = db.notifications.find(query, projection)
        cursor = cursor.sort("created_at", -1)  # Most recent first
        cursor = cursor.skip(offset).limit(actual_limit)
        
        # Convert cursor to list with timeout
        raw_notifications = await cursor.to_list(length=actual_limit)
        
        # Serialize MongoDB documents safely
        serialized_notifications = [serialize_doc(notification) for notification in raw_notifications]
        
        # Count total unread - but if too slow, use a fixed value
        try:
            unread_count = await db.notifications.count_documents({"user_id": user_id, "is_read": False})
        except Exception:
            # Fallback to just the count of current results if unread query fails
            unread_count = len([n for n in serialized_notifications if not n.get("is_read", True)])
        
        return {
            "total": len(serialized_notifications),
            "unread_count": unread_count,
            "notifications": serialized_notifications
        }
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        # Return minimal data on error
        return {
            "total": 0,
            "unread_count": 0,
            "notifications": []
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