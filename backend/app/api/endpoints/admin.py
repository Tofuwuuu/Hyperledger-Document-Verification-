from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.db.collections import alumni_profiles_collection, documents_collection, get_default_db, users_collection
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


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
        "full_name": user_doc.get("full_name"),
        "email": user_doc.get("email"),
        "is_active": bool(user_doc.get("is_active", True)),
        "is_admin": bool(user_doc.get("is_admin", False)),
        "is_verified": bool(user_doc.get("is_verified", False)),
        "role_id": user_doc.get("role_id", "admin"),
        "role": "Administrator" if bool(user_doc.get("is_admin", False)) else "Alumni",
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at"),
    }


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


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
    items = [
        {
            "id": "admin",
            "name": "Administrator",
            "description": "Full admin access",
            "permissions": ["manage_users", "manage_roles", "view_admin_dashboard"],
        }
    ]
    return {
        "items": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": len(items),
            "totalPages": 1,
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
    now = datetime.now(timezone.utc)
    update_data = {
        "verification_status": "approved",
        "status": "approved",
        "admin_notes": payload.admin_notes or "Verified and approved.",
        "verified_by": current_user.get("sub"),
        "verified_at": now,
        "updated_at": now,
    }
    result = await documents_collection(get_motor_client()).update_one({"_id": object_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Verification request not found")
    return {"success": True, "document_id": document_id, "status": "approved"}


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
    file_url = f"/{str(file_path).lstrip('/')}" if isinstance(file_path, str) and file_path else ""
    status = document.get("verification_status") or document.get("status") or "pending"
    return {
        "id": str(document.get("_id")),
        "documentType": document.get("document_type") or "Document",
        "studentName": (user or {}).get("full_name") or (profile or {}).get("full_name") or "Unknown Student",
        "status": status,
        "program": (profile or {}).get("course") or (profile or {}).get("department") or "N/A",
        "submissionDate": _iso_or_now(document.get("uploaded_at") or document.get("created_at")),
        "studentId": (profile or {}).get("student_id") or "N/A",
        "documentPreviewUrl": file_url,
        "fileUrl": file_url,
        "notes": document.get("admin_notes"),
        "documentId": str(document.get("_id")),
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
