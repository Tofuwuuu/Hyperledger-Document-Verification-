import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.collections import notifications_collection
from app.db.session import get_motor_client
from app.schemas.notifications import NotificationCreateRequest
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def _notification_identifiers(current_user: dict[str, Any]) -> list[Any]:
    subject = current_user.get("sub")
    identifiers: list[Any] = []
    if subject:
        identifiers.append(subject)
        try:
            identifiers.append(ObjectId(str(subject)))
        except Exception:
            pass
    return identifiers


def _notification_query(current_user: dict[str, Any], include_read: bool) -> dict[str, Any]:
    identifiers = _notification_identifiers(current_user)
    query: dict[str, Any] = {"user_id": {"$in": identifiers}}
    if not include_read:
        query["read"] = False
    return query


def _serialize_notification(doc: dict[str, Any]) -> dict[str, Any]:
    notification_id = str(doc.get("_id"))
    created_at = doc.get("created_at")
    metadata = doc.get("metadata") or {}
    message = doc.get("body") or doc.get("title") or "New notification"
    is_read = bool(doc.get("read", False))

    return {
        "id": notification_id,
        "_id": notification_id,
        "notification_id": notification_id,
        "user_id": str(doc.get("user_id")) if doc.get("user_id") is not None else None,
        "title": doc.get("title"),
        "body": doc.get("body"),
        "message": message,
        "type": doc.get("type") or "notification",
        "read": is_read,
        "is_read": is_read,
        "created_at": created_at,
        "timestamp": created_at,
        "metadata": metadata,
        "data": metadata,
        "document_id": metadata.get("document_id"),
    }


def _notification_object_id_or_404(notification_id: str) -> ObjectId:
    try:
        return ObjectId(notification_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Notification not found") from exc


@router.get("/notifications")
async def list_notifications(
    include_read: bool = Query(True),
    since_id: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool | None = None,
    current_user: dict = Depends(get_current_user),
) -> Any:
    client = get_motor_client()
    col = notifications_collection(client)

    if unread_only is not None:
        include_read = not unread_only

    query = _notification_query(current_user, include_read)

    if since_id:
        try:
            anchor = await col.find_one({"_id": ObjectId(since_id)})
        except Exception:
            anchor = None
        anchor_created_at = (anchor or {}).get("created_at")
        if isinstance(anchor_created_at, datetime):
            query["created_at"] = {"$gt": anchor_created_at}

    cursor = col.find(query).sort("created_at", -1).skip(int(offset)).limit(int(limit))
    notifications = [_serialize_notification(doc) async for doc in cursor]

    unread_query = _notification_query(current_user, include_read=False)
    unread_count = await col.count_documents(unread_query)

    return {
        "notifications": notifications,
        "count": len(notifications),
        "unread_count": unread_count,
    }


@router.post("/notifications")
async def create_notification(payload: NotificationCreateRequest, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = notifications_collection(client)
    is_admin = bool(current_user.get("is_admin", False))
    target_user_id = payload.user_id or current_user.get("sub")
    if payload.user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required to notify other users")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": target_user_id,
        "title": payload.title,
        "body": payload.body,
        "type": payload.type,
        "metadata": payload.metadata,
        "read": False,
        "created_at": now,
    }
    result = await col.insert_one(doc)
    return {"success": True, "notification_id": str(result.inserted_id)}


@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    col = notifications_collection(client)
    query = _notification_query(current_user, include_read=True)
    await col.update_many(query, {"$set": {"read": True}})
    return {"success": True}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_as_read(notification_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    col = notifications_collection(client)
    object_id = _notification_object_id_or_404(notification_id)
    query = {
        "_id": object_id,
        "user_id": {"$in": _notification_identifiers(current_user)},
    }
    result = await col.update_one(query, {"$set": {"read": True}})
    if getattr(result, "matched_count", 0) == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    col = notifications_collection(client)
    object_id = _notification_object_id_or_404(notification_id)
    query = {
        "_id": object_id,
        "user_id": {"$in": _notification_identifiers(current_user)},
    }
    result = await col.delete_one(query)
    if getattr(result, "deleted_count", 0) == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}
