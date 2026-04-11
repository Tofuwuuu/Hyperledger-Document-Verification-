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
from app.schemas.alumni_profile import AlumniProfileCreate, AlumniProfileUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


def _alumni_collection(client):
    try:
        db = client.get_default_database()
    except Exception:
        db = client["cvsu_alumni"]
    return db["alumni_profiles"]


def _serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    if not document:
        return {}

    result = {**document}
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
    collection = _alumni_collection(client)
    try:
        document = await collection.find_one({"user_id": user_id})
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by user_id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not document:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    return _serialize_document(document)


@router.get("/alumni/{alumni_id}")
async def get_alumni_by_id(alumni_id: str) -> dict[str, Any]:
    client = get_motor_client()
    collection = _alumni_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    try:
        document = await collection.find_one({"_id": object_id})
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not document:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    return _serialize_document(document)


@router.post("/alumni")
async def create_alumni_profile(payload: AlumniProfileCreate) -> dict[str, Any]:
    client = get_motor_client()
    collection = _alumni_collection(client)

    if not payload.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    existing = await collection.find_one({"user_id": payload.user_id})
    if existing:
        raise HTTPException(status_code=409, detail="Alumni profile already exists for this user")

    document = payload.dict()
    document["created_at"] = datetime.now(timezone.utc)
    document["updated_at"] = document["created_at"]

    try:
        result = await collection.insert_one(document)
        document["_id"] = result.inserted_id
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Alumni profile already exists")
    except PyMongoError as exc:
        logger.exception("Database error creating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return _serialize_document(document)


@router.put("/alumni/{alumni_id}")
async def update_alumni_profile(alumni_id: str, payload: AlumniProfileUpdate) -> dict[str, Any]:
    client = get_motor_client()
    collection = _alumni_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    update_data = payload.dict(exclude_unset=True)
    update_data.pop("user_id", None)
    update_data["updated_at"] = datetime.now(timezone.utc)

    try:
        result = await collection.update_one({"_id": object_id}, {"$set": update_data})
    except PyMongoError as exc:
        logger.exception("Database error updating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    updated_document = await collection.find_one({"_id": object_id})
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
    collection = _alumni_collection(client)

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
    collection = _alumni_collection(client)

    try:
        await collection.update_one(
            {"_id": object_id},
            {"$set": {"profile_picture": f"uploads/{filename}", "updated_at": datetime.now(timezone.utc)}}
        )
    except PyMongoError as exc:
        logger.exception("Database error updating profile picture path")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return {"success": True, "path": f"uploads/{filename}"}
