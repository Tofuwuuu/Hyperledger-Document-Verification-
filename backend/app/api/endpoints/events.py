from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.collections import event_registrations_collection, events_collection
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


class EventPayload(BaseModel):
    title: str
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    location: str | None = None
    image_url: str | None = None
    registration_url: str | None = None
    category: str | None = None
    department: str | None = None
    is_active: bool = True
    max_attendees: int | None = None
    registration_deadline: str | None = None
    requires_approval: bool = False
    registration_count: int | None = None


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _registration_count(client, event_id: ObjectId) -> int:
    return await event_registrations_collection(client).count_documents(
        {"event_id": event_id, "status": {"$ne": "cancelled"}}
    )


async def _serialize_event(client, doc: dict[str, Any]) -> dict[str, Any]:
    result = {**doc}
    result["_id"] = str(doc["_id"])
    result["id"] = result["_id"]
    result["registration_count"] = await _registration_count(client, doc["_id"])
    for key in ("created_by",):
        if key in result and result[key] is not None and not isinstance(result[key], str):
            result[key] = str(result[key])
    return result


def _simple_svg_data_uri(text: str) -> str:
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>
<rect width='100%' height='100%' fill='white'/>
<rect x='12' y='12' width='216' height='216' fill='none' stroke='black' stroke-width='4'/>
<text x='50%' y='48%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='14'>QR Placeholder</text>
<text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='10'>{safe}</text>
</svg>"""
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


@router.get("/events/upcoming")
async def get_upcoming_events(limit: int = 5) -> list[dict]:
    client = get_motor_client()
    now = datetime.now(timezone.utc)
    docs = []
    cursor = events_collection(client).find({"is_active": True}).sort("start_date", 1)
    async for doc in cursor:
        start = _coerce_datetime(doc.get("start_date"))
        if start and start >= now:
            docs.append(await _serialize_event(client, doc))
        if len(docs) >= limit:
            break
    return docs


@router.get("/events")
async def get_events(active_only: bool = False) -> list[dict]:
    client = get_motor_client()
    query = {"is_active": True} if active_only else {}
    cursor = events_collection(client).find(query).sort("start_date", 1)
    return [await _serialize_event(client, doc) async for doc in cursor]


@router.get("/events/{event_id}")
async def get_event(event_id: str) -> dict:
    object_id = _object_id(event_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Event not found")
    client = get_motor_client()
    doc = await events_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    return await _serialize_event(client, doc)


@router.post("/events")
async def create_event(payload: EventPayload, current_user: dict = Depends(_require_admin)) -> dict:
    client = get_motor_client()
    now = datetime.now(timezone.utc)
    doc = payload.model_dump()
    doc["created_by"] = ObjectId(current_user["sub"])
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await events_collection(client).insert_one(doc)
    created = await events_collection(client).find_one({"_id": result.inserted_id})
    return await _serialize_event(client, created)


@router.put("/events/{event_id}")
async def update_event(event_id: str, payload: dict[str, Any], current_user: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id(event_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Event not found")
    client = get_motor_client()
    update_data = {**payload, "updated_at": datetime.now(timezone.utc)}
    await events_collection(client).update_one({"_id": object_id}, {"$set": update_data})
    updated = await events_collection(client).find_one({"_id": object_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    return await _serialize_event(client, updated)


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id(event_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Event not found")
    result = await events_collection(get_motor_client()).delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}


@router.get("/events/{event_id}/qrcode")
async def get_event_qrcode(event_id: str, type: str = "registration", current_user: dict = Depends(_require_admin)) -> dict:
    return {"qr_code_url": _simple_svg_data_uri(f"{type}:{event_id}")}


@router.get("/events/{event_id}/attendance-qrcode")
async def get_attendance_qrcode(event_id: str, current_user: dict = Depends(_require_admin)) -> dict:
    return {"qr_code_url": _simple_svg_data_uri(f"attendance:{event_id}")}
