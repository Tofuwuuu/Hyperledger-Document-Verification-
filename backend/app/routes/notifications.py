from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.utils.auth import get_current_user
from app.config.database import get_database
from app.models.user import UserInDB

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_notifications(
    skip: int = 0, 
    limit: int = 50,
    mark_as_read: bool = False,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get all notifications for the current user.
    """
    user_id = str(current_user.id)
    
    # Query notifications for the current user
    query = {"user_id": user_id}
    notifications_cursor = db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit)
    notifications = await notifications_cursor.to_list(length=limit)
    
    # Convert ObjectId to string
    for notification in notifications:
        notification["id"] = str(notification["_id"])
    
    # Mark as read if requested
    if mark_as_read and notifications:
        notification_ids = [ObjectId(notification["_id"]) for notification in notifications]
        await db.notifications.update_many(
            {"_id": {"$in": notification_ids}, "read": False},
            {"$set": {"read": True}}
        )
        
        # Update read status in response
        for notification in notifications:
            notification["read"] = True
    
    return notifications

@router.get("/unread-count", response_model=int)
async def get_unread_notifications_count(
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get count of unread notifications for the current user.
    """
    user_id = str(current_user.id)
    
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "read": False
    })
    
    return count

@router.put("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(
    notification_id: str,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mark a notification as read.
    """
    user_id = str(current_user.id)
    
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
        {"$set": {"read": True}}
    )
    
    return {"message": "Notification marked as read"}

@router.put("/mark-all-read", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user.
    """
    user_id = str(current_user.id)
    
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "message": "All notifications marked as read",
        "modified_count": result.modified_count
    }

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Delete a notification.
    """
    user_id = str(current_user.id)
    
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