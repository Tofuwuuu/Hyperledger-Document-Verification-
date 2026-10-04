from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.db.session import get_motor_client
from app.db.collections import alumni_profiles_collection
from app.schemas.alumni_profile import PROFILE_FIELDS, AlumniProfileCreate, AlumniProfileUpdate
from app.utils.auth import get_current_user
from app.utils.uploads import IMAGE_KINDS, read_validated_upload, safe_extension_for_mime

logger = logging.getLogger(__name__)
router = APIRouter()


def _users_collection(client):
    try:
        db = client.get_default_database()
    except Exception:
        db = client["cvsu_alumni"]
    return db["users"]


# Fields any signed-in user may see about another alumni (directory view).
_PUBLIC_FIELDS = {
    "full_name",
    "graduation_year",
    "batch",
    "course",
    "department",
    "bio",
    "profile_picture",
    "current_job",
    "current_employer",
    "is_verified",
}
# Extra fields the owner and admins may see. Secrets (password hashes, reset
# tokens, MFA secrets, token versions) are never in either list.
_PRIVATE_FIELDS = _PUBLIC_FIELDS | {
    "user_id",
    "email",
    "student_id",
    "phone",
    "sex",
    "civil_status",
    "birthday",
    "region_of_origin",
    "address",
    "is_admin",
    "mfa_enabled",
    "created_at",
    "updated_at",
}


def _json_safe(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _serialize_document(document: dict[str, Any] | None, *, private: bool = True) -> dict[str, Any]:
    if not document:
        return {}
    allowed = _PRIVATE_FIELDS if private else _PUBLIC_FIELDS
    result = {key: _json_safe(value) for key, value in document.items() if key in allowed}
    if "_id" in document:
        object_id = _json_safe(document["_id"])
        result["_id"] = object_id
        result["id"] = object_id
    return result


def _owner_ids(document: dict[str, Any] | None, fallback_id: Any = None) -> set[str]:
    ids = {str(fallback_id)} if fallback_id is not None else set()
    if document:
        for key in ("user_id", "_id"):
            if document.get(key) is not None:
                ids.add(str(document[key]))
    return ids


def _can_see_private(current_user: dict[str, Any], document: dict[str, Any] | None, fallback_id: Any = None) -> bool:
    return bool(current_user.get("is_admin")) or str(current_user.get("sub")) in _owner_ids(document, fallback_id)


def _allowlisted(update: dict[str, Any]) -> dict[str, Any]:
    return {key: update[key] for key in PROFILE_FIELDS if key in update}


def _get_object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


def _uploads_dir() -> Path:
    uploads_dir = Path(__file__).resolve().parents[3] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir


@router.get("/alumni/health")
async def alumni_health() -> dict[str, str]:
    return {"status": "ok", "message": "Alumni profile API is available"}


@router.get("/alumni/user/{user_id}")
async def get_alumni_by_user(user_id: str, current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
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

    return _serialize_document(document, private=_can_see_private(current_user, document, user_id))


@router.get("/alumni/{alumni_id}")
async def get_alumni_by_id(alumni_id: str, current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
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

    return _serialize_document(document, private=_can_see_private(current_user, document))


@router.post("/alumni")
async def create_alumni_profile(payload: AlumniProfileCreate, current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Fill in profile fields on a user record.

    Signed-in users may only write their own record; admins may write any.
    Only PROFILE_FIELDS are stored, so is_admin, role, and verification
    fields can't be set here.
    """
    client = get_motor_client()
    collection = _users_collection(client)

    target_id = payload.user_id or str(current_user.get("sub", ""))
    object_id = _get_object_id(target_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid user ID")
    if not current_user.get("is_admin") and str(object_id) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="You can only edit your own profile")

    existing = await collection.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    document = _allowlisted(payload.model_dump(exclude_unset=True))
    document["updated_at"] = datetime.now(timezone.utc)

    try:
        await collection.update_one({"_id": object_id}, {"$set": document})
        updated_document = await collection.find_one({"_id": object_id})
    except PyMongoError as exc:
        logger.exception("Database error creating alumni profile")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return _serialize_document(updated_document)


@router.put("/alumni/{alumni_id}")
async def update_alumni_profile(
    alumni_id: str,
    payload: AlumniProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update (or create) a profile. Owner or admin only; allowlisted fields only."""
    client = get_motor_client()
    users = _users_collection(client)
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")

    raw = payload.model_dump(exclude_unset=True)
    payload_user_id = raw.get("user_id")
    update_data = _allowlisted(raw)
    if "email" in raw:
        # Display copy on the profile only; the login email lives on the user record.
        update_data["email"] = raw["email"]
    # Normalize empty strings to None so Mongo doesn't store empty strings for optional fields
    for k, v in list(update_data.items()):
        if isinstance(v, str) and v.strip() == "":
            update_data[k] = None
    update_data["updated_at"] = datetime.now(timezone.utc)

    profiles = alumni_profiles_collection(client)
    is_admin = bool(current_user.get("is_admin"))
    current_id = str(current_user.get("sub"))

    try:
        existing_profile = await profiles.find_one({"_id": object_id})
        if existing_profile:
            profile_filter = {"_id": object_id}
        else:
            existing_profile = await profiles.find_one({"user_id": object_id})
            profile_filter = {"_id": existing_profile["_id"]} if existing_profile else {"_id": object_id}

        if existing_profile:
            owner_id = existing_profile.get("user_id") or existing_profile.get("_id")
        elif is_admin and payload_user_id:
            owner_id = _get_object_id(str(payload_user_id))
            if owner_id is None:
                raise HTTPException(status_code=400, detail="Invalid user ID")
        else:
            # New profile: its id is the owner's user id.
            user = await users.find_one({"_id": object_id}, {"_id": 1})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            owner_id = object_id

        if not is_admin and str(owner_id) != current_id:
            raise HTTPException(status_code=403, detail="You can only edit your own profile")

        if not existing_profile:
            update_data["user_id"] = owner_id

        await profiles.update_one(profile_filter, {"$set": update_data}, upsert=True)
    except PyMongoError as exc:
        logger.exception("Database error updating alumni profile %s", alumni_id)
        raise HTTPException(status_code=503, detail="Database error") from exc

    updated_document = await profiles.find_one(profile_filter)
    return _serialize_document(updated_document)


@router.post("/alumni/simple")
async def create_alumni_profile_simple(payload: AlumniProfileCreate, current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
    profile = await create_alumni_profile(payload, current_user)
    return {"success": True, "id": profile.get("_id"), "profile": profile}


@router.put("/alumni/{alumni_id}/simple")
async def update_alumni_profile_simple(
    alumni_id: str,
    payload: AlumniProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    profile = await update_alumni_profile(alumni_id, payload, current_user)
    return {"success": True, "id": str(profile.get("_id")), "profile": profile}


class AlumniListResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    offset: int
    limit: int


@router.get("/alumni")
async def list_alumni_profiles(
    offset: int = 0,
    limit: int = 25,
    current_user: dict = Depends(get_current_user),
) -> AlumniListResponse:
    """Signed-in users only. Non-admins get directory fields; admins get contact fields too.
    Secrets are never included."""
    client = get_motor_client()
    collection = _users_collection(client)
    offset = max(offset, 0)
    limit = max(min(limit, 100), 1)
    private = bool(current_user.get("is_admin"))

    try:
        cursor = collection.find().skip(offset).limit(limit)
        documents = [_serialize_document(doc, private=private) async for doc in cursor]
        total = await collection.count_documents({})
    except PyMongoError as exc:
        logger.exception("Database error listing alumni profiles")
        raise HTTPException(status_code=503, detail="Database error") from exc

    return AlumniListResponse(results=documents, total=total, offset=offset, limit=limit)


@router.get("/alumni/list")
async def list_alumni_profiles_alias(
    offset: int = 0,
    limit: int = 25,
    current_user: dict = Depends(get_current_user),
) -> AlumniListResponse:
    return await list_alumni_profiles(offset=offset, limit=limit, current_user=current_user)


@router.post("/alumni/{alumni_id}/profile-picture")
async def upload_alumni_profile_picture(
    alumni_id: str,
    profile_picture: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    object_id = _get_object_id(alumni_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Invalid alumni profile ID")
    if not current_user.get("is_admin") and str(object_id) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="You can only change your own picture")

    contents, mime = await read_validated_upload(profile_picture, IMAGE_KINDS)
    # Server-chosen name: never trust the client filename on disk.
    filename = f"{alumni_id}_{secrets.token_hex(8)}{safe_extension_for_mime(mime)}"
    saved_path = _uploads_dir() / filename

    try:
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
