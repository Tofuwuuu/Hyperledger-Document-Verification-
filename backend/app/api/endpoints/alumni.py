from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.db.session import get_motor_client
from app.db.collections import alumni_profiles_collection
from app.schemas.alumni_profile import AlumniProfileCreate, AlumniProfileUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


def _users_collection(client):
    try:
        db = client.get_default_database()
    except Exception:
        db = client["cvsu_alumni"]
    return db["users"]


def _serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    if not document:
        return {}

    result = {**document}
    result.pop("password_hash", None)
    result.pop("hashed_password", None)
    if "_id" in result:
        object_id = str(result["_id"])
        result["_id"] = object_id
        result["id"] = object_id
    return result


def _get_object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


@router.get("/alumni/health")
async def alumni_health() -> dict[str, str]:
    return {"status": "ok", "message": "Alumni profile API is available"}


@router.get("/alumni/user/{user_id}")
async def get_alumni_by_user(user_id: str) -> dict[str, Any]:
    client = get_motor_client()
    profiles = alumni_profiles_collection(client)
    users = _users_collection(client)
    object_id = _get_object_id(user_id)
    profile_queries: list[dict[str, Any]] = []
    if object_id is not None:
        profile_queries.extend([{"_id": object_id}, {"user_id": object_id}])
    profile_queries.append({"user_id": user_id})

    try:
        document = None
        for query in profile_queries:
            document = await profiles.find_one(query)
            if document:
                break

        if not document:
            user_query = {"_id": object_id} if object_id is not None else {"user_id": user_id}
            document = await users.find_one(user_query)
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by user_id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not document:
        return JSONResponse(status_code=200, content=None)

    return _serialize_document(document)


@router.get("/alumni/{alumni_id}")
async def get_alumni_by_id(alumni_id: str) -> dict[str, Any]:
    client = get_motor_client()
    profiles = alumni_profiles_collection(client)
    users = _users_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    try:
        document = await profiles.find_one({"_id": object_id})
        if not document:
            document = await profiles.find_one({"user_id": object_id})
        if not document:
            document = await users.find_one({"_id": object_id})
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not document:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    return _serialize_document(document)


@router.post("/alumni")
async def create_alumni_profile(payload: AlumniProfileCreate) -> dict[str, Any]:
    client = get_motor_client()
    collection = _users_collection(client)

    if not payload.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    object_id = _get_object_id(payload.user_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid user ID")

    existing = await collection.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    document = payload.dict(exclude_unset=True)
    document.pop("user_id", None)
    document["updated_at"] = datetime.now(timezone.utc)

    try:
        await collection.update_one({"_id": object_id}, {"$set": document})
        updated_document = await collection.find_one({"_id": object_id})
    except PyMongoError as exc:
        logger.exception("Database error creating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return _serialize_document(updated_document)


@router.put("/alumni/{alumni_id}")
async def update_alumni_profile(alumni_id: str, payload: AlumniProfileUpdate) -> dict[str, Any]:
    client = get_motor_client()
    collection = _users_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    update_data = payload.dict(exclude_unset=True)
    payload_user_id = update_data.pop("user_id", None)
    update_data.pop("password_hash", None)
    update_data.pop("hashed_password", None)
    update_data.pop("is_admin", None)
    # Normalize empty strings to None so Mongo doesn't store empty strings for optional fields
    for k, v in list(update_data.items()):
        if isinstance(v, str) and v.strip() == "":
            update_data[k] = None

    # Recursively remove any `_id` or `id` keys from the update payload so we do
    # not attempt to modify MongoDB's immutable `_id` field even if nested objects
    # include IDs coming from the frontend.
    def _remove_id_keys(obj):
        if isinstance(obj, dict):
            obj.pop("_id", None)
            obj.pop("id", None)
            for val in obj.values():
                _remove_id_keys(val)
        elif isinstance(obj, list):
            for item in obj:
                _remove_id_keys(item)

    _remove_id_keys(update_data)

    update_data["updated_at"] = datetime.now(timezone.utc)
    owner_id = _get_object_id(str(payload_user_id)) if payload_user_id else object_id
    if owner_id is not None:
        update_data["user_id"] = owner_id

    profile_filter = {"_id": object_id}

    # Use the alumni_profiles collection for profile updates (not the users collection)
    profiles = alumni_profiles_collection(client)

    try:
        # Log useful debug info before attempting the update to help diagnose
        # any remaining cases where an `_id` might still be present in the payload.
        logger.debug("Updating alumni profile %s with filter=%s keys=%s", alumni_id, profile_filter, list(update_data.keys()))
        # Use upsert=True to create the document if it doesn't exist yet. This avoids 404s
        # originating from a missing document when clients attempt to save a profile.
        result = await profiles.update_one(profile_filter, {"$set": update_data}, upsert=True)
    except PyMongoError as exc:
        # Log the update payload to help debugging the immutable _id error
        try:
            logger.exception("Database error updating alumni profile. update_data=%s", update_data)
            # Also persist a copy to disk for easier inspection during debugging
            try:
                debug_path = Path(__file__).resolve().parents[2] / "update_debug.log"
                with debug_path.open("a", encoding="utf-8") as fh:
                    fh.write(f"{datetime.now(timezone.utc).isoformat()} FILTER={profile_filter} UPDATE={repr(update_data)}\n")
            except Exception:
                logger.exception("Failed writing update_debug.log")
        except Exception:
            logger.exception("Database error updating alumni profile (failed to stringify update_data)")
        raise HTTPException(status_code=503, detail="Database error") from exc

    # If upsert created a new document, matched_count may be 0 but upserted_id will be set.
    # Continue and fetch the resulting document in either case.

    updated_document = await profiles.find_one({"_id": object_id})
    return _serialize_document(updated_document)


@router.post("/alumni/simple")
async def create_alumni_profile_simple(payload: AlumniProfileCreate) -> dict[str, Any]:
    profile = await create_alumni_profile(payload)
    return {"success": True, "id": profile.get("_id"), "profile": profile}


@router.put("/alumni/{alumni_id}/simple")
async def update_alumni_profile_simple(alumni_id: str, payload: AlumniProfileUpdate) -> dict[str, Any]:
    profile = await update_alumni_profile(alumni_id, payload)
    return {"success": True, "id": str(profile.get("_id")), "profile": profile}


class AlumniListResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    offset: int
    limit: int


@router.get("/alumni")
async def list_alumni_profiles(offset: int = 0, limit: int = 25) -> AlumniListResponse:
    client = get_motor_client()
    collection = _users_collection(client)

    try:
        cursor = collection.find().skip(offset).limit(limit)
        documents = [ _serialize_document(doc) async for doc in cursor ]
        total = await collection.count_documents({})
    except PyMongoError as exc:
        logger.exception("Database error listing alumni profiles")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return AlumniListResponse(results=documents, total=total, offset=offset, limit=limit)


@router.get("/alumni/list")
async def list_alumni_profiles_alias(offset: int = 0, limit: int = 25) -> AlumniListResponse:
    return await list_alumni_profiles(offset=offset, limit=limit)


@router.post("/alumni/{alumni_id}/profile-picture")
async def upload_alumni_profile_picture(alumni_id: str, profile_picture: UploadFile = File(...)) -> dict[str, Any]:
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    uploads_dir = Path(__file__).resolve().parents[3] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{alumni_id}_{Path(profile_picture.filename).name}".replace(' ', '_')
    saved_path = uploads_dir / filename

    try:
        contents = await profile_picture.read()
        saved_path.write_bytes(contents)
    except Exception as exc:
        logger.exception("Error saving profile picture")
        raise HTTPException(status_code=500, detail="Could not save profile picture") from exc

    client = get_motor_client() 
    collection = _users_collection(client)

    try:
        await collection.update_one(
            {"_id": object_id},
            {"$set": {"profile_picture": f"uploads/{filename}", "updated_at": datetime.now(timezone.utc)}}
        )
    except PyMongoError as exc:
        logger.exception("Database error updating profile picture path")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return {"success": True, "path": f"uploads/{filename}"}
