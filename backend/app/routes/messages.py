from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.utils.auth import get_current_user
from app.config.database import get_database
from app.models.user import UserInDB

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_message(
    message: dict,
    current_user: UserInDB = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new message.
    """
    message_data = {
        "sender_id": str(current_user.id),
        "recipient_id": message.get("recipient_id"),
        "content": message.get("content"),
        "created_at": datetime.utcnow(),
        "read": False
    }
    
    result = await db.messages.insert_one(message_data)
    
    created_message = await db.messages.find_one({"_id": result.inserted_id})
    created_message["id"] = str(created_message["_id"])
    
    return created_message

@router.get("/", response_model=List[dict])
async def get_messages(
    skip: int = 0, 
    limit: int = 100,
    other_user_id: Optional[str] = None,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get all messages for the current user.
    """
    user_id = str(current_user.id)
    
    if other_user_id:
        # Get conversation between current user and other user
        query = {
            "$or": [
                {"sender_id": user_id, "recipient_id": other_user_id},
                {"sender_id": other_user_id, "recipient_id": user_id}
            ]
        }
    else:
        # Get all messages sent to or from the current user
        query = {
            "$or": [
                {"sender_id": user_id},
                {"recipient_id": user_id}
            ]
        }
    
    messages_cursor = db.messages.find(query).sort("created_at", -1).skip(skip).limit(limit)
    messages = await messages_cursor.to_list(length=limit)
    
    # Convert ObjectId to string
    for message in messages:
        message["id"] = str(message["_id"])
    
    return messages

@router.get("/unread", response_model=int)
async def get_unread_count(
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get count of unread messages for the current user.
    """
    user_id = str(current_user.id)
    
    count = await db.messages.count_documents({
        "recipient_id": user_id,
        "read": False
    })
    
    return count

@router.put("/{message_id}/read", status_code=status.HTTP_200_OK)
async def mark_message_read(
    message_id: str,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mark a message as read.
    """
    user_id = str(current_user.id)
    
    message = await db.messages.find_one({"_id": ObjectId(message_id)})
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check if user is the recipient
    if message.get("recipient_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to mark this message as read"
        )
    
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"read": True}}
    )
    
    return {"message": "Message marked as read"} 