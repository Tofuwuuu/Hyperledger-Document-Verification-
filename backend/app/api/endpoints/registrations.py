from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.collections import alumni_profiles_collection, event_registrations_collection, events_collection, users_collection
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


class RegistrationCreate(BaseModel):
    event_id: str
    user_id: str | None = None


class RegistrationStatusUpdate(BaseModel):
    status: Literal["registered", "attended", "cancelled"]


class QrCheckInPayload(BaseModel):
    qr_data: str


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


async def _require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


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


async def _serialize_registration(client, doc: dict[str, Any]) -> dict[str, Any]:
    event = await events_collection(client).find_one({"_id": doc.get("event_id")})
    result = {**doc}
    result["_id"] = str(doc["_id"])
    result["id"] = result["_id"]
    result["event_id"] = str(doc["event_id"])
    result["user_id"] = str(doc["user_id"])
    result["registration_date"] = doc.get("registered_at") or doc.get("created_at")
    if event:
        result["event_title"] = event.get("title")
        result["event_date"] = event.get("start_date")
        result["event_location"] = event.get("location")
    return result


async def _create_or_restore_registration(client, event_id: ObjectId, user_id: ObjectId) -> dict[str, Any]:
    event = await events_collection(client).find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.get("is_active", True):
        raise HTTPException(status_code=400, detail="Event is not active")

    registration_deadline = _coerce_datetime(event.get("registration_deadline"))
    if registration_deadline and datetime.now(timezone.utc) > registration_deadline:
        raise HTTPException(status_code=400, detail="Registration for this event is closed")

    existing = await event_registrations_collection(client).find_one({"event_id": event_id, "user_id": user_id})
    if existing and existing.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail="Already registered for this event")

    max_attendees = event.get("max_attendees")
    if max_attendees:
        count = await event_registrations_collection(client).count_documents({"event_id": event_id, "status": {"$ne": "cancelled"}})
        if count >= max_attendees:
            raise HTTPException(status_code=400, detail="Event has reached maximum capacity")

    now = datetime.now(timezone.utc)
    if existing and existing.get("status") == "cancelled":
        await event_registrations_collection(client).update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": "registered", "registered_at": now, "updated_at": now}},
        )
        saved = await event_registrations_collection(client).find_one({"_id": existing["_id"]})
        return await _serialize_registration(client, saved)

    doc = {
        "event_id": event_id,
        "user_id": user_id,
        "status": "registered",
        "registered_at": now,
        "created_at": now,
        "updated_at": now,
        "check_in_time": None,
    }
    result = await event_registrations_collection(client).insert_one(doc)
    saved = await event_registrations_collection(client).find_one({"_id": result.inserted_id})
    return await _serialize_registration(client, saved)


@router.post("/registrations")
async def create_registration(payload: RegistrationCreate, current_user: dict = Depends(_require_auth)) -> dict:
    client = get_motor_client()
    event_id = _object_id(payload.event_id)
    user_id = _object_id(payload.user_id or current_user.get("sub", ""))
    if event_id is None or user_id is None:
        raise HTTPException(status_code=400, detail="Invalid event_id or user_id")
    return await _create_or_restore_registration(client, event_id, user_id)


@router.get("/registrations/user")
async def get_user_registrations(current_user: dict = Depends(_require_auth)) -> list[dict]:
    client = get_motor_client()
    user_id = ObjectId(current_user["sub"])
    cursor = event_registrations_collection(client).find({"user_id": user_id}).sort("created_at", -1)
    return [await _serialize_registration(client, doc) async for doc in cursor]


@router.get("/registrations/event/{event_id}")
async def get_event_registrations(event_id: str, current_user: dict = Depends(_require_admin)) -> list[dict]:
    event_object_id = _object_id(event_id)
    if event_object_id is None:
        raise HTTPException(status_code=404, detail="Event not found")
    client = get_motor_client()
    users = users_collection(client)
    cursor = event_registrations_collection(client).find({"event_id": event_object_id}).sort("created_at", -1)
    results = []
    async for doc in cursor:
        row = await _serialize_registration(client, doc)
        user = await users.find_one({"_id": doc.get("user_id")}, {"full_name": 1, "email": 1})
        row["user_name"] = (user or {}).get("full_name")
        row["email"] = (user or {}).get("email")
        row["user_email"] = row["email"]
        results.append(row)
    return results


@router.get("/registrations/all")
async def get_all_registrations(current_user: dict = Depends(_require_admin)) -> list[dict]:
    client = get_motor_client()
    cursor = event_registrations_collection(client).find({}).sort("created_at", -1)
    return [await _serialize_registration(client, doc) async for doc in cursor]


@router.post("/registrations/{registration_id}/check-in")
async def check_in_registration(registration_id: str, current_user: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id(registration_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    client = get_motor_client()
    now = datetime.now(timezone.utc)
    await event_registrations_collection(client).update_one(
        {"_id": object_id},
        {"$set": {"status": "attended", "check_in_time": now, "updated_at": now}},
    )
    saved = await event_registrations_collection(client).find_one({"_id": object_id})
    if not saved:
        raise HTTPException(status_code=404, detail="Registration not found")
    return await _serialize_registration(client, saved)


@router.delete("/registrations/{registration_id}")
async def cancel_registration(registration_id: str, current_user: dict = Depends(_require_auth)) -> dict:
    object_id = _object_id(registration_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    client = get_motor_client()
    reg = await event_registrations_collection(client).find_one({"_id": object_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if not current_user.get("is_admin") and str(reg.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to cancel this registration")
    await event_registrations_collection(client).update_one(
        {"_id": object_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )
    return {"success": True}


@router.put("/registrations/{registration_id}")
async def update_registration_status(registration_id: str, payload: RegistrationStatusUpdate, current_user: dict = Depends(_require_auth)) -> dict:
    object_id = _object_id(registration_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    client = get_motor_client()
    reg = await event_registrations_collection(client).find_one({"_id": object_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if not current_user.get("is_admin") and str(reg.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to update this registration")
    current_status = str(reg.get("status") or "registered")
    allowed_transitions = {
        "registered": {"attended", "cancelled", "registered"},
        "attended": {"attended"},
        "cancelled": {"registered", "cancelled"},
    }
    if payload.status not in allowed_transitions.get(current_status, {payload.status}):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {current_status} to {payload.status}",
        )

    update_data = {"status": payload.status, "updated_at": datetime.now(timezone.utc)}
    if payload.status == "attended":
        update_data["check_in_time"] = datetime.now(timezone.utc)
    await event_registrations_collection(client).update_one({"_id": object_id}, {"$set": update_data})
    saved = await event_registrations_collection(client).find_one({"_id": object_id})
    return await _serialize_registration(client, saved)


@router.get("/registrations/event/{event_id}/attendees")
async def get_event_attendees(event_id: str, current_user: dict = Depends(_require_admin)) -> dict:
    event_object_id = _object_id(event_id)
    if event_object_id is None:
        raise HTTPException(status_code=404, detail="Event not found")
    client = get_motor_client()
    event = await events_collection(client).find_one({"_id": event_object_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)
    cursor = event_registrations_collection(client).find({"event_id": event_object_id}).sort("created_at", -1)
    attendees = []
    stats = {"total": 0, "registered": 0, "attended": 0, "cancelled": 0}
    async for doc in cursor:
        user = await users.find_one({"_id": doc.get("user_id")}, {"full_name": 1, "email": 1})
        profile = await profiles.find_one({"user_id": doc.get("user_id")}, {"student_id": 1, "department": 1, "year_level": 1, "profile_picture": 1})
        status = doc.get("status", "registered")
        stats["total"] += 1
        if status == "attended":
            stats["attended"] += 1
        elif status == "cancelled":
            stats["cancelled"] += 1
        else:
            stats["registered"] += 1
        attendees.append(
            {
                "_id": str(doc["_id"]),
                "id": str(doc["_id"]),
                "user_id": str(doc["user_id"]),
                "user_name": (user or {}).get("full_name"),
                "user_email": (user or {}).get("email"),
                "user_student_id": (profile or {}).get("student_id"),
                "user_department": (profile or {}).get("department"),
                "user_year_level": (profile or {}).get("year_level"),
                "user_profile_pic": (profile or {}).get("profile_picture"),
                "status": status,
                "registration_date": doc.get("registered_at") or doc.get("created_at"),
                "check_in_time": doc.get("check_in_time"),
            }
        )
    non_cancelled = stats["registered"] + stats["attended"]
    attendance_rate = round((stats["attended"] / non_cancelled) * 100, 2) if non_cancelled > 0 else 0
    return {
        "event": {
            "_id": str(event["_id"]),
            "id": str(event["_id"]),
            "title": event.get("title"),
            "start_date": event.get("start_date"),
            "location": event.get("location"),
        },
        "statistics": {**stats, "attendance_rate": attendance_rate},
        "attendees": attendees,
    }


@router.post("/registrations/check-in-qr")
async def check_in_by_qr(payload: QrCheckInPayload, current_user: dict = Depends(_require_auth)) -> dict:
    raw = (payload.qr_data or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid QR data")
    parts = raw.split(":")
    event_id_str = parts[1] if len(parts) >= 2 else raw
    event_object_id = _object_id(event_id_str)
    if event_object_id is None:
        raise HTTPException(status_code=400, detail="Invalid QR data")
    user_object_id = _object_id(str(current_user.get("sub", "")))
    if user_object_id is None:
        raise HTTPException(status_code=401, detail="Invalid user session")

    client = get_motor_client()
    registration = await event_registrations_collection(client).find_one(
        {"event_id": event_object_id, "user_id": user_object_id, "status": {"$ne": "cancelled"}}
    )
    if not registration:
        raise HTTPException(status_code=404, detail="No active registration found for this event")

    now = datetime.now(timezone.utc)
    await event_registrations_collection(client).update_one(
        {"_id": registration["_id"]},
        {"$set": {"status": "attended", "check_in_time": now, "updated_at": now}},
    )
    saved = await event_registrations_collection(client).find_one({"_id": registration["_id"]})
    return await _serialize_registration(client, saved)


@router.post("/registrations/quick-register/{event_id}/{token}")
async def quick_register(event_id: str, token: str, current_user: dict = Depends(_require_auth)) -> dict:
    if not token.strip():
        raise HTTPException(status_code=400, detail="Invalid registration token")
    event_object_id = _object_id(event_id)
    user_object_id = _object_id(str(current_user.get("sub", "")))
    if event_object_id is None or user_object_id is None:
        raise HTTPException(status_code=400, detail="Invalid event_id or user session")
    return await _create_or_restore_registration(get_motor_client(), event_object_id, user_object_id)


@router.post("/registrations/quick-attend/{token}")
async def quick_attend(token: str) -> dict:
    registration_id = _object_id(token)
    if registration_id is None:
        raise HTTPException(status_code=400, detail="Invalid attendance token")
    client = get_motor_client()
    registration = await event_registrations_collection(client).find_one({"_id": registration_id})
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    now = datetime.now(timezone.utc)
    await event_registrations_collection(client).update_one(
        {"_id": registration_id},
        {"$set": {"status": "attended", "check_in_time": now, "updated_at": now}},
    )
    saved = await event_registrations_collection(client).find_one({"_id": registration_id})
    return await _serialize_registration(client, saved)
