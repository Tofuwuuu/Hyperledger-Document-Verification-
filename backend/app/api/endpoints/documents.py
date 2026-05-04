from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pymongo.errors import PyMongoError

from app.db.collections import alumni_profiles_collection, documents_collection, users_collection, get_default_db
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


def _uploads_dir() -> Path:
    uploads_dir = Path(__file__).resolve().parents[3] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir


def _hex_digest(raw: bytes) -> str:
    return sha256(raw).hexdigest()


async def _require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


async def _resolve_profile(client, alumni_id: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    profiles = alumni_profiles_collection(client)
    users = users_collection(client)
    object_id = _object_id(alumni_id)
    if object_id is None:
        return None, None

    profile = await profiles.find_one({"_id": object_id})
    if profile:
        user = await users.find_one({"_id": profile.get("user_id")})
        return profile, user

    profile = await profiles.find_one({"user_id": object_id})
    if profile:
        user = await users.find_one({"_id": object_id})
        return profile, user

    return None, None


def _serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    result = {**document}
    if "_id" in result:
        result["_id"] = str(result["_id"])
        result["id"] = result["_id"]
    if "user_id" in result and not isinstance(result["user_id"], str):
        result["user_id"] = str(result["user_id"])
    if "alumni_profile_id" in result and result["alumni_profile_id"] is not None and not isinstance(result["alumni_profile_id"], str):
        result["alumni_profile_id"] = str(result["alumni_profile_id"])
    return result


@router.post("/documents/upload")
async def upload_document(
    alumni_id: str = Form(...),
    document_type: str = Form(...),
    title: str = Form(...),
    description: str | None = Form(default=None),
    file: UploadFile = File(...),
    current_user: dict = Depends(_require_auth),
) -> dict:
    client = get_motor_client()
    profile, user = await _resolve_profile(client, alumni_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Alumni profile not found")

    current_user_id = current_user.get("sub")
    if not current_user.get("is_admin") and str(profile.get("user_id")) != str(current_user_id):
        raise HTTPException(status_code=403, detail="Not allowed to upload for this alumni profile")

    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{Path(file.filename).name}".replace(" ", "_")
    relative_path = f"uploads/{filename}"
    saved_path = _uploads_dir() / filename

    content = await file.read()
    saved_path.write_bytes(content)
    file_hash = _hex_digest(content)

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": profile.get("user_id"),
        "alumni_profile_id": profile.get("_id"),
        "student_id": profile.get("student_id"),
        "document_type": document_type,
        "title": title,
        "description": description,
        "file_path": relative_path,
        "file_name": Path(file.filename).name,
        "mime_type": file.content_type,
        "file_size": len(content),
        "file_hash": file_hash,
        "status": "pending",
        "verification_status": "pending",
        "uploaded_at": now,
        "created_at": now,
        "updated_at": now,
    }

    result = await documents_collection(client).insert_one(doc)
    return {
        "success": True,
        "document_id": str(result.inserted_id),
        "file_path": relative_path,
        "document": _serialize_document({**doc, "_id": result.inserted_id}),
    }


@router.get("/documents/alumni/{alumni_id}")
async def get_alumni_documents(alumni_id: str, current_user: dict = Depends(_require_auth)) -> list[dict]:
    client = get_motor_client()
    profile, _user = await _resolve_profile(client, alumni_id)
    if not profile:
        return []

    current_user_id = current_user.get("sub")
    if not current_user.get("is_admin") and str(profile.get("user_id")) != str(current_user_id):
        raise HTTPException(status_code=403, detail="Not allowed to view documents for this alumni profile")

    cursor = documents_collection(client).find({"alumni_profile_id": profile.get("_id")}).sort("created_at", -1)
    return [_serialize_document(doc) async for doc in cursor]


@router.get("/documents/search")
async def search_documents(verification_status: str | None = None, current_user: dict = Depends(_require_auth)) -> list[dict]:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    client = get_motor_client()
    query = {}
    if verification_status:
        query["verification_status"] = verification_status
    cursor = documents_collection(client).find(query).sort("created_at", -1)
    return [_serialize_document(doc) async for doc in cursor]


@router.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(_require_auth)) -> dict:
    object_id = _object_id(document_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Document not found")
    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.get("is_admin") and str(doc.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to view this document")
    return _serialize_document(doc)


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(_require_auth)) -> dict:
    object_id = _object_id(document_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Document not found")
    client = get_motor_client()
    collection = documents_collection(client)
    doc = await collection.find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.get("is_admin") and str(doc.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to delete this document")

    file_path = doc.get("file_path")
    if file_path:
        full_path = Path(__file__).resolve().parents[3] / file_path
        if full_path.exists():
            full_path.unlink()

    await collection.delete_one({"_id": object_id})
    return {"success": True}


@router.get("/documents/pending/all")
async def get_all_pending_documents(current_user: dict = Depends(_require_auth)) -> list[dict]:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    client = get_motor_client()
    cursor = documents_collection(client).find({"verification_status": "pending"}).sort("created_at", -1)
    return [_serialize_document(doc) async for doc in cursor]


@router.get("/documents/activities")
async def get_document_activities(current_user: dict = Depends(_require_auth)) -> list[dict]:
    client = get_motor_client()
    query: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        user_id = _object_id(str(current_user.get("sub", "")))
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid user session")
        query["user_id"] = user_id

    users = users_collection(client)
    cursor = documents_collection(client).find(query).sort("uploaded_at", -1).limit(20)
    activities: list[dict[str, Any]] = []
    async for document in cursor:
        user = await users.find_one({"_id": document.get("user_id")}, {"full_name": 1, "email": 1})
        full_name = (user or {}).get("full_name")
        activities.append(
            {
                "id": f"document-upload-{document['_id']}",
                "type": "document_upload",
                "status": document.get("verification_status") or document.get("status") or "pending",
                "title": "Recent Upload",
                "description": f"{full_name or 'An alumni'} uploaded {document.get('title') or document.get('document_type') or 'a document'}",
                "timestamp": (document.get("uploaded_at") or document.get("created_at") or datetime.now(timezone.utc)).isoformat(),
                "user_name": full_name,
                "email": (user or {}).get("email"),
                "document_type": document.get("document_type"),
                "data": {
                    "full_name": full_name,
                    "email": (user or {}).get("email"),
                    "document_type": document.get("document_type"),
                    "document_title": document.get("title"),
                },
            }
        )
    return activities


@router.post("/documents/{document_id}/reject")
async def reject_document(document_id: str, payload: dict, current_user: dict = Depends(_require_auth)) -> dict:
    # Admin-only: mark a document as rejected with an optional reason and write an audit log
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    object_id = _object_id(document_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Document not found")

    client = get_motor_client()
    collection = documents_collection(client)
    doc = await collection.find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    reason = None
    try:
        reason = payload.get("reason") if isinstance(payload, dict) else None
    except Exception:
        reason = None

    now = datetime.now(timezone.utc)
    update = {"verification_status": "rejected", "rejection_reason": reason, "updated_at": now}
    await collection.update_one({"_id": object_id}, {"$set": update})

    # write audit log
    db = get_default_db(client)
    try:
        await db["audit_logs"].insert_one({
            "action": "document_rejected",
            "document_id": str(object_id),
            "rejected_by": str(current_user.get("sub")),
            "reason": reason,
            "timestamp": now,
        })
    except Exception:
        # if audit write fails, do not block the main action
        pass

    return {"success": True, "document_id": str(object_id), "status": "rejected"}
