from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo.errors import PyMongoError

from app.db.collections import alumni_profiles_collection, users_collection
from app.db.session import get_motor_client
from app.schemas.alumni_profile import AlumniProfileCreate, AlumniProfileUpdate
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


def _merge_profile_with_user(profile: dict[str, Any] | None, user: dict[str, Any] | None) -> dict[str, Any]:
    if not profile and not user:
        return {}

    result: dict[str, Any] = {}
    if profile:
        result.update(profile)
    if user:
        result.update(
            {
                "email": result.get("email") or user.get("email"),
                "full_name": result.get("full_name") or user.get("full_name"),
                "is_admin": bool(user.get("is_admin", False)),
                "is_verified": bool(user.get("is_verified", False)),
                "user_id": str(user.get("_id")),
            }
        )

    result.pop("password_hash", None)
    result.pop("hashed_password", None)
    if "_id" in result:
        object_id = str(result["_id"])
        result["_id"] = object_id
        result["id"] = object_id
    if "user_id" in result and not isinstance(result["user_id"], str):
        result["user_id"] = str(result["user_id"])
    return result


async def _load_profile_with_user_by_profile_id(client, profile_id: ObjectId) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    profiles = alumni_profiles_collection(client)
    users = users_collection(client)
    profile = await profiles.find_one({"_id": profile_id})
    if not profile:
        return None, None
    user = await users.find_one({"_id": profile.get("user_id")})
    return profile, user


async def _load_profile_with_user_by_user_id(client, user_id: ObjectId) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    profiles = alumni_profiles_collection(client)
    users = users_collection(client)
    profile = await profiles.find_one({"user_id": user_id})
    user = await users.find_one({"_id": user_id})
    return profile, user


@router.get("/alumni/health")
async def alumni_health() -> dict[str, str]:
    return {"status": "ok", "message": "Alumni profile API is available"}


@router.get("/alumni/user/{user_id}")
async def get_alumni_by_user(user_id: str) -> dict[str, Any]:
    client = get_motor_client()
    object_id = _get_object_id(user_id)
    if object_id is None:
        return JSONResponse(status_code=200, content=None)

    try:
        profile, user = await _load_profile_with_user_by_user_id(client, object_id)
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by user_id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not profile:
        return JSONResponse(status_code=200, content=None)

    return _merge_profile_with_user(profile, user)


@router.get("/alumni/me")
async def get_my_alumni_profile(current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
    client = get_motor_client()
    user_id = _get_object_id(str(current_user.get("sub", "")))
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid user session")
    try:
        profile, user = await _load_profile_with_user_by_user_id(client, user_id)
    except PyMongoError as exc:
        logger.exception("Database error fetching current alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not profile:
        raise HTTPException(status_code=404, detail="Alumni profile not found")
    return _merge_profile_with_user(profile, user)


@router.get("/alumni/{alumni_id}")
async def get_alumni_by_id(alumni_id: str) -> dict[str, Any]:
    if alumni_id == "list":
        response = await list_alumni_profiles()
        return response.model_dump()

    client = get_motor_client()
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    try:
        profile, user = await _load_profile_with_user_by_profile_id(client, object_id)
        if not profile:
            profile, user = await _load_profile_with_user_by_user_id(client, object_id)
    except PyMongoError as exc:
        logger.exception("Database error fetching alumni profile by id")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if not profile:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    return _merge_profile_with_user(profile, user)


@router.post("/alumni")
async def create_alumni_profile(payload: AlumniProfileCreate) -> dict[str, Any]:
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    if not payload.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    object_id = _get_object_id(payload.user_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid user ID")

    user = await users.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    document = payload.dict(exclude_unset=True)
    document.pop("user_id", None)
    if document.get("email"):
        document["email"] = str(document["email"]).strip().lower()
    if not document.get("full_name"):
        document["full_name"] = user.get("full_name", "")
    document["user_id"] = object_id
    now = datetime.now(timezone.utc)
    document["updated_at"] = now

    try:
        await profiles.update_one(
            {"user_id": object_id},
            {"$set": document, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        user_update = {}
        if document.get("full_name"):
            user_update["full_name"] = document["full_name"]
        if document.get("email"):
            user_update["email"] = document["email"]
        if user_update:
            user_update["updated_at"] = now
            await users.update_one({"_id": object_id}, {"$set": user_update})
        profile = await profiles.find_one({"user_id": object_id})
        user = await users.find_one({"_id": object_id})
    except PyMongoError as exc:
        logger.exception("Database error creating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return _merge_profile_with_user(profile, user)


@router.put("/alumni/{alumni_id}")
async def update_alumni_profile(alumni_id: str, payload: AlumniProfileUpdate) -> dict[str, Any]:
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    update_data = payload.dict(exclude_unset=True)
    update_data.pop("user_id", None)
    update_data.pop("password_hash", None)
    update_data.pop("hashed_password", None)
    update_data.pop("is_admin", None)
    if "email" in update_data and update_data["email"] is not None:
        update_data["email"] = str(update_data["email"]).strip().lower()
    update_data["updated_at"] = datetime.now(timezone.utc)

    try:
        profile = await profiles.find_one({"_id": object_id})
        profile_filter = {"_id": object_id}
        if not profile:
            profile = await profiles.find_one({"user_id": object_id})
            if profile:
                profile_filter = {"user_id": object_id}

        result = await profiles.update_one(profile_filter, {"$set": update_data})
    except PyMongoError as exc:
        logger.exception("Database error updating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    updated_profile = await profiles.find_one(profile_filter)
    user_object_id = updated_profile.get("user_id")
    user_update = {}
    if update_data.get("full_name") is not None:
        user_update["full_name"] = update_data["full_name"]
    if update_data.get("email") is not None:
        user_update["email"] = update_data["email"]
    if user_update:
        user_update["updated_at"] = datetime.now(timezone.utc)
        await users.update_one({"_id": user_object_id}, {"$set": user_update})
    user = await users.find_one({"_id": user_object_id})
    return _merge_profile_with_user(updated_profile, user)


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
    profiles = alumni_profiles_collection(client)
    users = users_collection(client)

    try:
        cursor = profiles.find().skip(offset).limit(limit)
        documents = []
        async for profile in cursor:
            user = await users.find_one({"_id": profile.get("user_id")})
            documents.append(_merge_profile_with_user(profile, user))
        total = await profiles.count_documents({})
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
    filename = f"{alumni_id}_{Path(profile_picture.filename).name}".replace(" ", "_")
    saved_path = uploads_dir / filename

    try:
        contents = await profile_picture.read()
        saved_path.write_bytes(contents)
    except Exception as exc:
        logger.exception("Error saving profile picture")
        raise HTTPException(status_code=500, detail="Could not save profile picture") from exc

    client = get_motor_client()
    profiles = alumni_profiles_collection(client)

    try:
        result = await profiles.update_one(
            {"_id": object_id},
            {"$set": {"profile_picture": f"uploads/{filename}", "updated_at": datetime.now(timezone.utc)}},
        )
        if result.matched_count == 0:
            await profiles.update_one(
                {"user_id": object_id},
                {"$set": {"profile_picture": f"uploads/{filename}", "updated_at": datetime.now(timezone.utc)}},
            )
    except PyMongoError as exc:
        logger.exception("Database error updating profile picture path")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return {"success": True, "path": f"uploads/{filename}"}
