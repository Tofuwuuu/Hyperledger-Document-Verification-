from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, EmailStr, Field

from app.db.collections import alumni_profiles_collection, documents_collection, get_default_db, roles_collection, users_collection
from app.db.session import get_motor_client
from app.services.blockchain_manager import get_blockchain_manager
from app.utils.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


class AdminUserCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)
    role_id: str | None = None
    is_active: bool = True
    is_admin: bool = True


class AdminUserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=6, max_length=128)
    role_id: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None


class AdminProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    employee_id: str | None = None
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    address: str | None = None
    bio: str | None = None


class VerificationActionPayload(BaseModel):
    admin_notes: str | None = None


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _object_id_or_404(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Invalid user ID") from exc


def _serialize_admin_user(user_doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user_doc.get("_id", "")),
        "_id": str(user_doc.get("_id", "")),
        "full_name": user_doc.get("full_name"),
        "email": user_doc.get("email"),
        "employee_id": user_doc.get("employee_id"),
        "department": user_doc.get("department"),
        "position": user_doc.get("position"),
        "phone": user_doc.get("phone"),
        "address": user_doc.get("address"),
        "bio": user_doc.get("bio"),
        "profile_picture": user_doc.get("profile_picture"),
        "is_active": bool(user_doc.get("is_active", True)),
        "is_admin": bool(user_doc.get("is_admin", False)),
        "is_verified": bool(user_doc.get("is_verified", False)),
        "role_id": user_doc.get("role_id", "admin"),
        "role": "Administrator" if bool(user_doc.get("is_admin", False)) else "Alumni",
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at"),
    }


async def _load_profile_for_user_id(profiles, user_id: ObjectId) -> dict[str, Any] | None:
    projection = {"full_name": 1, "email": 1, "student_id": 1, "graduation_year": 1}
    profile = await profiles.find_one({"user_id": user_id}, projection)
    if profile is None:
        profile = await profiles.find_one({"user_id": str(user_id)}, projection)
    return profile


def _serialize_pending_verification_user(
    user_doc: dict[str, Any],
    profile_doc: dict[str, Any] | None = None,
) -> dict[str, Any]:
    profile = profile_doc or {}
    graduation_year = profile.get("graduation_year") or user_doc.get("graduation_year")

    return {
        "id": str(user_doc.get("_id", "")),
        "_id": str(user_doc.get("_id", "")),
        "full_name": profile.get("full_name") or user_doc.get("full_name"),
        "email": user_doc.get("email") or profile.get("email"),
        "student_id": profile.get("student_id") or user_doc.get("student_id"),
        "graduation_year": str(graduation_year) if graduation_year is not None else None,
        "is_active": bool(user_doc.get("is_active", True)),
        "is_verified": bool(user_doc.get("is_verified", False)),
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at"),
    }


def _serialize_role(role_doc: dict[str, Any]) -> dict[str, Any]:
    role_id = str(role_doc.get("_id", ""))
    permissions = role_doc.get("permissions", []) or []
    normalized_permissions = [
        item.get("id") if isinstance(item, dict) else item
        for item in permissions
    ]
    normalized_permissions = [item for item in normalized_permissions if item]

    return {
        "id": role_id,
        "_id": role_id,
        "name": role_doc.get("name"),
        "description": role_doc.get("description"),
        "permissions": normalized_permissions,
        "is_active": bool(role_doc.get("is_active", True)),
        "created_at": role_doc.get("created_at"),
        "updated_at": role_doc.get("updated_at"),
    }


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _uploads_dir() -> Path:
    uploads_dir = Path(__file__).resolve().parents[3] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir


def _document_file_hash(document: dict[str, Any]) -> str | None:
    existing_hash = document.get("file_hash")
    if isinstance(existing_hash, str) and existing_hash:
        return existing_hash

    file_path = document.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        return None

    full_path = Path(__file__).resolve().parents[3] / file_path
    if not full_path.exists():
        return None

    return sha256(full_path.read_bytes()).hexdigest()


async def _load_current_admin(current_user: dict[str, Any]) -> dict[str, Any]:
    user_id = str(current_user.get("sub", ""))
    object_id = _object_id_or_404(user_id)
    user = await users_collection(get_motor_client()).find_one({"_id": object_id, "is_admin": True})
    if not user:
        raise HTTPException(status_code=404, detail="Admin profile not found")
    return user


@router.get("/admin/profile")
async def get_admin_profile(current_user: dict = Depends(_require_admin)) -> dict:
    user = await _load_current_admin(current_user)
    return _serialize_admin_user(user)


@router.put("/admin/profile")
async def update_admin_profile(payload: AdminProfileUpdateRequest, current_user: dict = Depends(_require_admin)) -> dict:
    user = await _load_current_admin(current_user)
    users = users_collection(get_motor_client())
    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        normalized_email = _normalize_email(str(update_data["email"]))
        existing = await users.find_one({"email": normalized_email})
        if existing and existing.get("_id") != user.get("_id"):
            raise HTTPException(status_code=400, detail="Email already registered")
        update_data["email"] = normalized_email

    update_data["updated_at"] = datetime.now(timezone.utc)
    await users.update_one({"_id": user["_id"]}, {"$set": update_data})
    updated = await users.find_one({"_id": user["_id"]})
    return _serialize_admin_user(updated)


@router.post("/admin/profile/upload-picture")
async def upload_admin_profile_picture(
    profile_picture: UploadFile = File(...),
    current_user: dict = Depends(_require_admin),
) -> dict:
    user = await _load_current_admin(current_user)
    filename = f"admin_{user['_id']}_{Path(profile_picture.filename).name}".replace(" ", "_")
    saved_path = _uploads_dir() / filename

    try:
        contents = await profile_picture.read()
        saved_path.write_bytes(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not save profile picture") from exc

    relative_path = f"uploads/{filename}"
    await users_collection(get_motor_client()).update_one(
        {"_id": user["_id"]},
        {"$set": {"profile_picture": relative_path, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"success": True, "path": relative_path}


@router.get("/admin/users")
async def list_admin_users(
    page: int = 1,
    limit: int = 10,
    _: dict = Depends(_require_admin),
) -> dict:
    client = get_motor_client()
    users = users_collection(client)
    page = max(page, 1)
    limit = max(min(limit, 100), 1)
    query = {"is_admin": True}

    total = await users.count_documents(query)
    cursor = users.find(query).skip((page - 1) * limit).limit(limit).sort("created_at", -1)
    items = [_serialize_admin_user(doc) async for doc in cursor]

    return {
        "items": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": math.ceil(total / limit) if total else 0,
        },
    }


@router.get("/admin/users/pending-verification")
async def list_pending_verification_users(
    status: str = Query(default="pending"),
    _: dict = Depends(_require_admin),
) -> list[dict]:
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    normalized_status = status.strip().lower()
    if normalized_status == "pending":
        query = {"is_verified": False}
    elif normalized_status == "verified":
        query = {"is_verified": True}
    else:
        raise HTTPException(status_code=400, detail="Invalid verification status filter")

    cursor = users.find(query).sort("created_at", -1)
    items: list[dict[str, Any]] = []
    async for user_doc in cursor:
        if user_doc.get("is_active") is False:
            continue
        profile = await _load_profile_for_user_id(profiles, user_doc["_id"])
        items.append(_serialize_pending_verification_user(user_doc, profile))
    return items


@router.get("/admin/users/{user_id}")
async def get_admin_user(user_id: str, _: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id_or_404(user_id)
    user = await users_collection(get_motor_client()).find_one({"_id": object_id, "is_admin": True})
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found")
    return _serialize_admin_user(user)


@router.post("/admin/users")
async def create_admin_user(payload: AdminUserCreateRequest, _: dict = Depends(_require_admin)) -> dict:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    client = get_motor_client()
    users = users_collection(client)
    normalized_email = _normalize_email(str(payload.email))
    existing = await users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.now(timezone.utc)
    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    doc = {
        "full_name": payload.full_name,
        "email": normalized_email,
        "password_hash": password_hash,
        "is_admin": bool(payload.is_admin),
        "is_active": bool(payload.is_active),
        "is_verified": True,
        "role_id": payload.role_id or "admin",
        "created_at": now,
        "updated_at": now,
    }
    result = await users.insert_one(doc)
    return _serialize_admin_user({**doc, "_id": result.inserted_id})


@router.put("/admin/users/{user_id}")
async def update_admin_user(user_id: str, payload: AdminUserUpdateRequest, _: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id_or_404(user_id)
    users = users_collection(get_motor_client())
    existing = await users.find_one({"_id": object_id, "is_admin": True})
    if not existing:
        raise HTTPException(status_code=404, detail="Admin user not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("password") or update_data.get("confirm_password"):
        if update_data.get("password") != update_data.get("confirm_password"):
            raise HTTPException(status_code=400, detail="Passwords do not match")
        update_data["password_hash"] = bcrypt.hashpw(
            update_data["password"].encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    update_data.pop("password", None)
    update_data.pop("confirm_password", None)
    if "email" in update_data and update_data["email"] is not None:
        update_data["email"] = _normalize_email(str(update_data["email"]))

    update_data["updated_at"] = datetime.now(timezone.utc)
    await users.update_one({"_id": object_id}, {"$set": update_data})
    updated = await users.find_one({"_id": object_id})
    return _serialize_admin_user(updated)


@router.post("/admin/users/{user_id}/verify")
async def verify_pending_user(
    user_id: str,
    payload: VerificationActionPayload,
    current_user: dict = Depends(_require_admin),
) -> dict:
    object_id = _object_id_or_404(user_id)
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    user = await users.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    await users.update_one(
        {"_id": object_id},
        {
            "$set": {
                "is_verified": True,
                "verification_pending": False,
                "verification_notes": payload.admin_notes,
                "verified_by": current_user.get("sub"),
                "verified_at": now,
                "updated_at": now,
            }
        },
    )
    updated = await users.find_one({"_id": object_id})
    profile = await _load_profile_for_user_id(profiles, object_id)
    return {
        "success": True,
        "message": f"User {(updated or {}).get('email') or user_id} verified successfully",
        "user": _serialize_pending_verification_user(updated or user, profile),
    }


@router.post("/admin/users/{user_id}/reject")
async def reject_pending_user(
    user_id: str,
    payload: VerificationActionPayload,
    current_user: dict = Depends(_require_admin),
) -> dict:
    object_id = _object_id_or_404(user_id)
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    user = await users.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    await users.update_one(
        {"_id": object_id},
        {
            "$set": {
                "is_active": False,
                "is_verified": False,
                "verification_pending": False,
                "verification_status": "rejected",
                "verification_notes": payload.admin_notes or "User verification rejected.",
                "rejected_by": current_user.get("sub"),
                "rejected_at": now,
                "updated_at": now,
            }
        },
    )
    updated = await users.find_one({"_id": object_id})
    profile = await _load_profile_for_user_id(profiles, object_id)
    return {
        "success": True,
        "message": f"User {(updated or {}).get('email') or user_id} rejected successfully",
        "user": _serialize_pending_verification_user(updated or user, profile),
    }


@router.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: str, _: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id_or_404(user_id)
    result = await users_collection(get_motor_client()).delete_one({"_id": object_id, "is_admin": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin user not found")
    return {"success": True}


@router.put("/admin/users/{user_id}/role")
async def update_admin_user_role(user_id: str, role_data: dict[str, Any], _: dict = Depends(_require_admin)) -> dict:
    object_id = _object_id_or_404(user_id)
    role_id = role_data.get("role_id", "admin")
    await users_collection(get_motor_client()).update_one(
        {"_id": object_id},
        {"$set": {"role_id": role_id, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await users_collection(get_motor_client()).find_one({"_id": object_id})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_admin_user(updated)


@router.get("/admin/roles")
async def list_roles(
    page: int = 1,
    limit: int = 10,
    _: dict = Depends(_require_admin),
) -> dict:
    client = get_motor_client()
    roles = roles_collection(client)
    page = max(page, 1)
    limit = max(min(limit, 100), 1)

    total = await roles.count_documents({})
    cursor = roles.find({}).skip((page - 1) * limit).limit(limit).sort("created_at", 1)
    items = [_serialize_role(doc) async for doc in cursor]

    return {
        "items": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": math.ceil(total / limit) if total else 0,
        },
    }


@router.get("/admin/permissions")
async def list_permissions(_: dict = Depends(_require_admin)) -> list[dict]:
    return [
        {"id": "manage_users", "name": "Manage Users", "description": "Create, update, and delete admin users"},
        {"id": "manage_roles", "name": "Manage Roles", "description": "Manage role assignments and role settings"},
        {"id": "manage_permissions", "name": "Manage Permissions", "description": "Assign and revoke role permissions"},
        {"id": "review_verifications", "name": "Review Verifications", "description": "Approve or reject document verifications"},
        {"id": "view_admin_dashboard", "name": "View Admin Dashboard", "description": "View admin statistics and recent activity"},
    ]


@router.get("/admin/verifications")
async def get_admin_verifications(status: str = "pending", _: dict = Depends(_require_admin)) -> list[dict]:
    client = get_motor_client()
    docs = documents_collection(client)
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    query: dict[str, Any] = {}
    normalized_status = status.strip().lower()
    if normalized_status != "all":
        query["verification_status"] = normalized_status

    cursor = docs.find(query).sort("uploaded_at", -1).limit(100)
    results: list[dict[str, Any]] = []
    async for document in cursor:
        user = await users.find_one({"_id": document.get("user_id")}, {"full_name": 1, "email": 1})
        profile = await profiles.find_one({"user_id": document.get("user_id")}, {"full_name": 1, "student_id": 1, "course": 1, "department": 1})
        results.append(_serialize_verification_document(document, user, profile))
    return results


@router.post("/admin/verifications/{document_id}/approve")
async def approve_verification(
    document_id: str,
    payload: VerificationActionPayload,
    current_user: dict = Depends(_require_admin),
) -> dict:
    object_id = _object_id_or_404(document_id)
    client = get_motor_client()
    docs = documents_collection(client)
    document = await docs.find_one({"_id": object_id})
    if not document:
        raise HTTPException(status_code=404, detail="Verification request not found")

    file_hash = _document_file_hash(document)
    if not file_hash:
        raise HTTPException(status_code=400, detail="Document file hash could not be determined")

    profiles = alumni_profiles_collection(client)
    users = users_collection(client)
    profile = await profiles.find_one({"_id": document.get("alumni_profile_id")})
    if not profile and document.get("user_id") is not None:
        profile = await profiles.find_one({"user_id": document.get("user_id")})
    user = await users.find_one({"_id": document.get("user_id")}) if document.get("user_id") is not None else None

    now = datetime.now(timezone.utc)
    metadata = {
        "student_id": (profile or {}).get("student_id"),
        "document_type": document.get("document_type"),
        "document_title": document.get("title"),
        "timestamp": (document.get("uploaded_at") or document.get("created_at") or now).isoformat()
        if isinstance(document.get("uploaded_at") or document.get("created_at") or now, datetime)
        else str(document.get("uploaded_at") or document.get("created_at") or now),
        "full_name": (profile or {}).get("full_name") or (user or {}).get("full_name"),
        "email": (profile or {}).get("email") or (user or {}).get("email"),
    }
    fallback_tx_id = f"mongo-fallback-{document_id}-{file_hash[:12]}"
    blockchain_error: str | None = None
    blockchain_result: dict[str, Any] = {
        "success": False,
        "transaction_id": fallback_tx_id,
        "timestamp": now.isoformat(),
    }

    try:
        blockchain_result = await asyncio.wait_for(
            get_blockchain_manager().store_document(document_id, file_hash, metadata),
            timeout=10,
        )
        if not blockchain_result.get("success"):
            blockchain_error = blockchain_result.get("message", "Blockchain storage failed")
            logger.warning(
                "Blockchain storage failed for document %s; approving with MongoDB fallback: %s",
                document_id,
                blockchain_error,
            )
            blockchain_result = {
                **blockchain_result,
                "transaction_id": blockchain_result.get("transaction_id") or fallback_tx_id,
                "timestamp": blockchain_result.get("timestamp") or now.isoformat(),
            }
    except asyncio.TimeoutError:
        blockchain_error = "Blockchain storage timed out"
        logger.warning(
            "Blockchain storage timed out for document %s; approving with MongoDB fallback",
            document_id,
        )
        blockchain_result = {
            "success": False,
            "transaction_id": fallback_tx_id,
            "timestamp": now.isoformat(),
        }
    except Exception as exc:
        blockchain_error = str(exc) or exc.__class__.__name__
        logger.exception(
            "Blockchain storage crashed for document %s; approving with MongoDB fallback",
            document_id,
        )
        blockchain_result = {
            "success": False,
            "transaction_id": fallback_tx_id,
            "timestamp": now.isoformat(),
        }

    blockchain_committed = bool(blockchain_result.get("success"))

    update_data = {
        "verification_status": "verified",
        "status": "approved",
        "admin_notes": payload.admin_notes or "Verified and approved.",
        "verified_by": current_user.get("sub"),
        "verified_at": now,
        "file_hash": file_hash,
        "blockchain_hash": file_hash,
        "blockchain_tx_id": blockchain_result.get("transaction_id"),
        "blockchain_recorded_at": blockchain_result.get("timestamp") or now.isoformat(),
        "blockchain_commit_status": "committed" if blockchain_committed else "fallback",
        "blockchain_error": blockchain_error,
        "updated_at": now,
    }
    result = await docs.update_one({"_id": object_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Verification request not found")

    await get_default_db(client)["verification_requests"].insert_one(
        {
            "document_id": document_id,
            "hash": file_hash,
            "metadata": metadata,
            "transaction_id": blockchain_result.get("transaction_id"),
            "blockchain_commit_status": update_data["blockchain_commit_status"],
            "blockchain_error": blockchain_error,
            "stored_by": str(current_user.get("sub")),
            "stored_at": now,
        }
    )
    return {
        "success": True,
        "document_id": document_id,
        "status": "approved",
        "verification_status": "verified",
        "transaction_id": blockchain_result.get("transaction_id"),
        "blockchain_committed": blockchain_committed,
        "blockchain_commit_status": update_data["blockchain_commit_status"],
        "blockchain_error": blockchain_error,
    }


@router.post("/admin/verifications/{document_id}/reject")
async def reject_verification(
    document_id: str,
    payload: VerificationActionPayload,
    current_user: dict = Depends(_require_admin),
) -> dict:
    object_id = _object_id_or_404(document_id)
    now = datetime.now(timezone.utc)
    update_data = {
        "verification_status": "rejected",
        "status": "rejected",
        "admin_notes": payload.admin_notes or "Document rejected due to verification issues.",
        "verified_by": current_user.get("sub"),
        "verified_at": now,
        "updated_at": now,
    }
    result = await documents_collection(get_motor_client()).update_one({"_id": object_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Verification request not found")
    return {"success": True, "document_id": document_id, "status": "rejected"}


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            return None
    return None


def _iso_or_now(value: Any) -> str:
    parsed = _coerce_datetime(value)
    if parsed is None:
        parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.isoformat()


def _serialize_verification_document(document: dict[str, Any], user: dict[str, Any] | None, profile: dict[str, Any] | None) -> dict[str, Any]:
    file_path = document.get("file_path")
    document_id = str(document.get("_id"))
    preview_url = f"/api/v1/documents/{document_id}/preview"
    download_url = f"/api/v1/documents/{document_id}/download"
    file_exists = False
    if isinstance(file_path, str) and file_path:
        try:
            full_path = (Path(__file__).resolve().parents[3] / file_path).resolve()
            uploads_root = _uploads_dir().resolve()
            file_exists = full_path.is_file() and full_path.is_relative_to(uploads_root)
        except Exception:
            file_exists = False
    status = document.get("verification_status") or document.get("status") or "pending"
    return {
        "id": document_id,
        "documentType": document.get("document_type") or "Document",
        "studentName": (user or {}).get("full_name") or (profile or {}).get("full_name") or "Unknown Student",
        "status": status,
        "program": (profile or {}).get("course") or (profile or {}).get("department") or "N/A",
        "submissionDate": _iso_or_now(document.get("uploaded_at") or document.get("created_at")),
        "studentId": (profile or {}).get("student_id") or "N/A",
        "documentPreviewUrl": preview_url,
        "fileUrl": download_url,
        "filePath": file_path or "",
        "fileName": document.get("file_name") or "",
        "fileExists": file_exists,
        "mimeType": document.get("mime_type") or "",
        "notes": document.get("admin_notes"),
        "documentId": document_id,
    }


@router.get("/admin/dashboard/stats")
async def get_admin_dashboard_stats(_: dict = Depends(_require_admin)) -> dict:
    client = get_motor_client()
    db = get_default_db(client)
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    total_alumni = await profiles.count_documents({})
    pending_verifications = await users.count_documents({"is_verified": False})

    verified_documents = 0
    if "documents" in await db.list_collection_names():
        verified_documents = await db["documents"].count_documents(
            {
                "$or": [
                    {"verification_status": "verified"},
                    {"status": "approved"},
                ]
            }
        )

    now = datetime.now(timezone.utc)
    recent_registration_cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
    new_registrations = 0
    async for user in users.find({}, {"created_at": 1}):
        created_at = _coerce_datetime(user.get("created_at"))
        if created_at and created_at >= recent_registration_cutoff:
            new_registrations += 1

    return {
        "totalAlumni": total_alumni,
        "pendingVerifications": pending_verifications,
        "verifiedDocuments": verified_documents,
        "newRegistrations": new_registrations,
    }


@router.get("/admin/dashboard/recent-activity")
async def get_admin_recent_activity(_: dict = Depends(_require_admin)) -> list[dict]:
    client = get_motor_client()
    db = get_default_db(client)
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)

    activities: list[dict[str, Any]] = []

    async for user in users.find({}, {"full_name": 1, "email": 1, "created_at": 1, "updated_at": 1, "is_verified": 1}).sort("created_at", -1).limit(10):
        activities.append(
            {
                "id": f"user-registration-{user['_id']}",
                "type": "registration",
                "status": "completed",
                "title": "User Registration",
                "description": f"{user.get('full_name') or user.get('email') or 'A user'} registered an account",
                "timestamp": _iso_or_now(user.get("created_at")),
                "user_name": user.get("full_name"),
                "email": user.get("email"),
                "data": {
                    "full_name": user.get("full_name"),
                    "email": user.get("email"),
                },
            }
        )
        if user.get("is_verified"):
            activities.append(
                {
                    "id": f"user-verification-{user['_id']}",
                    "type": "user_verification",
                    "status": "verified",
                    "title": "User Verification",
                    "description": f"{user.get('full_name') or user.get('email') or 'A user'} was verified",
                    "timestamp": _iso_or_now(user.get("updated_at") or user.get("created_at")),
                    "user_name": user.get("full_name"),
                    "email": user.get("email"),
                    "data": {
                        "full_name": user.get("full_name"),
                        "email": user.get("email"),
                    },
                }
            )

    async for profile in profiles.find({}, {"full_name": 1, "student_id": 1, "updated_at": 1, "created_at": 1, "current_job": 1}).sort("updated_at", -1).limit(10):
        activities.append(
            {
                "id": f"profile-update-{profile['_id']}",
                "type": "profile_update",
                "status": "completed",
                "title": "Profile Update",
                "description": f"{profile.get('full_name') or 'An alumni'} updated their alumni profile",
                "timestamp": _iso_or_now(profile.get("updated_at") or profile.get("created_at")),
                "user_name": profile.get("full_name"),
                "data": {
                    "full_name": profile.get("full_name"),
                    "student_id": profile.get("student_id"),
                },
            }
        )

    if "document_requests" in await db.list_collection_names():
        async for request in db["document_requests"].find({}, {"document_type": 1, "created_at": 1, "status": 1, "user_id": 1}).sort("created_at", -1).limit(10):
            user = await users.find_one({"_id": request.get("user_id")}, {"full_name": 1, "email": 1})
            full_name = user.get("full_name") if user else None
            activities.append(
                {
                    "id": f"document-request-{request['_id']}",
                    "type": "document_request",
                    "status": request.get("status", "pending"),
                    "title": "Document Request",
                    "description": f"{full_name or 'An alumni'} requested {request.get('document_type', 'a document')}",
                    "timestamp": _iso_or_now(request.get("created_at")),
                    "user_name": full_name,
                    "document_type": request.get("document_type"),
                    "data": {
                        "full_name": full_name,
                        "document_type": request.get("document_type"),
                    },
                }
            )

    if "documents" in await db.list_collection_names():
        async for document in db["documents"].find({}, {"title": 1, "document_type": 1, "uploaded_at": 1, "created_at": 1, "user_id": 1, "verification_status": 1}).sort("uploaded_at", -1).limit(10):
            user = await users.find_one({"_id": document.get("user_id")}, {"full_name": 1, "email": 1})
            full_name = user.get("full_name") if user else None
            activities.append(
                {
                    "id": f"document-upload-{document['_id']}",
                    "type": "document_upload",
                    "status": document.get("verification_status", "completed"),
                    "title": "Recent Upload",
                    "description": f"{full_name or 'An alumni'} uploaded {document.get('title') or document.get('document_type') or 'a document'}",
                    "timestamp": _iso_or_now(document.get("uploaded_at") or document.get("created_at")),
                    "user_name": full_name,
                    "document_type": document.get("document_type"),
                    "data": {
                        "full_name": full_name,
                        "document_type": document.get("document_type"),
                        "document_title": document.get("title"),
                    },
                }
            )

    activities.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return activities[:20]
