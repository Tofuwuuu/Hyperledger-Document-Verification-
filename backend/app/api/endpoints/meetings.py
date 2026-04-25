import logging
from datetime import datetime
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from app.db.session import get_motor_client
from app.db.collections import meetings_collection, events_collection
from app.schemas.meetings import MeetingCreateRequest
from app.api.register import get_current_user, _require_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/meetings")
async def list_meetings(event_id: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = 0, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = meetings_collection(client)
    query = {}
    if event_id:
        query["event_id"] = event_id
    cursor = col.find(query).sort("starts_at", 1).skip(int(offset)).limit(int(limit))
    results = []
    async for doc in cursor:
        results.append({"id": str(doc.get("_id")), "event_id": doc.get("event_id"), "title": doc.get("title"), "description": doc.get("description"), "starts_at": doc.get("starts_at"), "ends_at": doc.get("ends_at"), "location": doc.get("location"), "capacity": doc.get("capacity"), "created_at": doc.get("created_at")})
    return results


@router.post("/meetings")
async def create_meeting(payload: MeetingCreateRequest, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = meetings_collection(client)
    # optional event existence check
    if payload.event_id:
        ev_col = events_collection(client)
        ev = await ev_col.find_one({"_id": ObjectId(payload.event_id)})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
    now = datetime.utcnow()
    doc = {"event_id": payload.event_id, "title": payload.title, "description": payload.description, "starts_at": payload.starts_at, "ends_at": payload.ends_at, "location": payload.location, "capacity": payload.capacity, "created_at": now}
    result = await col.insert_one(doc)
    return {"id": str(result.inserted_id), "created_at": now}


@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = meetings_collection(client)
    try:
        m = await col.find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"id": str(m.get("_id")), "event_id": m.get("event_id"), "title": m.get("title"), "description": m.get("description"), "starts_at": m.get("starts_at"), "ends_at": m.get("ends_at"), "location": m.get("location"), "capacity": m.get("capacity"), "created_at": m.get("created_at")}


@router.get("/events/{event_id}/meetings")
async def event_meetings(event_id: str, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = meetings_collection(client)
    cursor = col.find({"event_id": event_id}).sort("starts_at", 1)
    results = []
    async for doc in cursor:
        results.append({"id": str(doc.get("_id")), "title": doc.get("title"), "starts_at": doc.get("starts_at")})
    return results


@router.post("/meetings/generate-token")
async def generate_meeting_token(meeting_id: str, current_user: dict = Depends(get_current_user)) -> Any:
    client = get_motor_client()
    col = meetings_collection(client)
    try:
        m = await col.find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow()
    # store token in meeting doc (simple implementation)
    await col.update_one({"_id": m["_id"]}, {"$set": {"last_token": token, "last_token_at": datetime.utcnow()}})
    join_url = f"https://meet.example.com/join?token={token}"
    return {"token": token, "expires_at": expires_at, "join_url": join_url}
