import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.session import get_motor_client
from app.db.collections import notifications_collection
from app.schemas.notifications import NotificationCreateRequest
from app.api.register import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/notifications")
async def list_notifications(limit: int = Query(50, ge=1, le=100), offset: int = 0, unread_only: bool = False, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = notifications_collection(client)
    query = {"user_id": current_user.get("sub")}
    if unread_only:
        query["read"] = False
    cursor = col.find(query).sort("created_at", -1).skip(int(offset)).limit(int(limit))
    results = []
    async for doc in cursor:
        results.append({"id": str(doc.get("_id")), "user_id": doc.get("user_id"), "title": doc.get("title"), "body": doc.get("body"), "type": doc.get("type"), "read": bool(doc.get("read", False)), "created_at": doc.get("created_at")})
    return results


@router.post("/notifications")
async def create_notification(payload: NotificationCreateRequest, current_user: dict = Depends(get_current_user)) -> Any:
    # Only admins can create notifications for arbitrary users; non-admins can create for themselves
    client = get_motor_client()
    col = notifications_collection(client)
    is_admin = bool(current_user.get("is_admin", False))
    if payload.user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required to notify other users")
    now = datetime.utcnow()
    doc = {"user_id": payload.user_id or current_user.get("sub"), "title": payload.title, "body": payload.body, "type": payload.type, "metadata": payload.metadata, "read": False, "created_at": now}
    result = await col.insert_one(doc)
    return {"success": True, "notification_id": str(result.inserted_id)}
