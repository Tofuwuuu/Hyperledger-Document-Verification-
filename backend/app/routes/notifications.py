from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from app.utils.auth import get_current_user
from app.config.database import get_database

router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[Dict[str, Any]]

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

@router.get("/", response_model=NotificationResponse)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_read: bool = Query(False),
    since_id: Optional[str] = Query(None, description="Get only notifications newer than this ID"),
    db = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all notifications for the current user.
    """
    user_id = current_user["_id"]
    
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
            print(f"Error processing since_id parameter: {str(e)}")
    
    # Query notifications for the current user
    notifications_cursor = db.notifications.find(query).sort("created_at", -1).skip(offset).limit(limit)
    notifications = await notifications_cursor.to_list(length=limit)
    
    # Serialize MongoDB documents
    serialized_notifications = [serialize_doc(notification) for notification in notifications]
    
    # Count unread notifications
    unread_count = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    return {
        "total": len(serialized_notifications),
        "unread_count": unread_count,
        "notifications": serialized_notifications
    }

@router.get("/unread-count", response_model=int)
async def get_unread_notifications_count(
    db = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get count of unread notifications for the current user.
    """
    user_id = current_user["_id"]
    
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    return count

@router.put("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(
    notification_id: str,
    db = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Mark a notification as read.
    """
    user_id = current_user["_id"]
    
    notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check if user is the recipient
    if notification.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this notification"
        )
    
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "Notification marked as read"}

@router.put("/mark-all-read", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    db = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user.
    """
    user_id = current_user["_id"]
    
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {
        "message": "All notifications marked as read",
        "modified_count": result.modified_count
    }

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    db = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a notification.
    """
    user_id = current_user["_id"]
    
    notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check if user is the recipient
    if notification.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this notification"
        )
    
    await db.notifications.delete_one({"_id": ObjectId(notification_id)}) 