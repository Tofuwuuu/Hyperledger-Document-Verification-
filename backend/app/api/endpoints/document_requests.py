from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.constants.document_types import (
    document_type_label,
    equivalent_document_types,
    is_supported_document_type,
    normalize_document_type,
)
from app.db.collections import alumni_profiles_collection, document_requests_collection, documents_collection, users_collection
from app.db.session import get_motor_client
from app.services.blockchain_manager import get_blockchain_manager
from app.utils.auth import get_current_user

router = APIRouter()


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _uploads_root() -> Path:
    return _backend_root() / "uploads"


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


class DocumentRequestCreate(BaseModel):
    document_type: str
    purpose: str | None = None


class DocumentRequestUpdate(BaseModel):
    status: str
    admin_notes: str | None = None
    rejection_reason: str | None = None


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


async def _require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


def _serialize_request(request: dict[str, Any]) -> dict[str, Any]:
    result = {**request}
    if "_id" in result:
        result["_id"] = str(result["_id"])
        result["id"] = result["_id"]
    for key in ("user_id", "document_id", "generated_document_id", "source_document_id"):
        if key in result and result[key] is not None and not isinstance(result[key], str):
            result[key] = str(result[key])
    return result


async def _find_profile_by_user(client, user_id: str) -> dict[str, Any] | None:
    return await alumni_profiles_collection(client).find_one({"user_id": ObjectId(user_id)})


async def _enrich_request(client, request: dict[str, Any]) -> dict[str, Any]:
    result = _serialize_request(request)
    user = await users_collection(client).find_one({"_id": request.get("user_id")}, {"full_name": 1, "email": 1})
    profile = await alumni_profiles_collection(client).find_one({"user_id": request.get("user_id")}, {"student_id": 1, "course": 1, "graduation_year": 1, "full_name": 1})
    result["alumni_name"] = (profile or {}).get("full_name") or (user or {}).get("full_name")
    result["student_id"] = (profile or {}).get("student_id")
    result["course"] = (profile or {}).get("course")
    result["graduation_year"] = (profile or {}).get("graduation_year")
    result["document_type_label"] = document_type_label(request.get("document_type"))
    return result


def _document_file_path(document: dict[str, Any]) -> Path:
    file_path = document.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        raise HTTPException(status_code=404, detail="Document file path is missing")
    uploads_root = _uploads_root().resolve()
    full_path = (_backend_root() / file_path).resolve()
    if not _is_relative_to(full_path, uploads_root):
        raise HTTPException(status_code=400, detail="Document file path is invalid")
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found in server storage")
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="Document file not found in server storage")
    return full_path


def _document_hash(raw: bytes) -> str:
    return sha256(raw).hexdigest()


def _mongo_hash_matches_verified_document(document: dict[str, Any], computed_hash: str) -> bool:
    persisted_hash = document.get("blockchain_hash")
    return (
        document.get("verification_status") == "verified"
        and isinstance(persisted_hash, str)
        and persisted_hash == computed_hash
    )


async def _resolve_uploaded_document(client, request: dict[str, Any]) -> dict[str, Any]:
    docs = documents_collection(client)
    matching_types = list(equivalent_document_types(str(request.get("document_type", ""))))
    if not matching_types:
        raise HTTPException(status_code=400, detail="Request document type is invalid")

    document = await docs.find_one(
        {
            "user_id": request.get("user_id"),
            "document_type": {"$in": matching_types},
            "status": "approved",
            "verification_status": "verified",
        },
        sort=[("verified_at", -1), ("updated_at", -1), ("created_at", -1)],
    )
    if not document:
        raise HTTPException(
            status_code=404,
            detail="No approved blockchain-verified uploaded document is available for this request type",
        )
    return document


async def _verify_document_release_integrity(document: dict[str, Any]) -> tuple[str, Path]:
    full_path = _document_file_path(document)
    content = full_path.read_bytes()
    computed_hash = _document_hash(content)

    verification = await get_blockchain_manager().verify_document(str(document["_id"]), computed_hash)
    if not verification.get("success"):
        raise HTTPException(
            status_code=502,
            detail=verification.get("message", "Blockchain verification failed during document release"),
        )
    if not verification.get("verified"):
        if verification.get("record") is None and _mongo_hash_matches_verified_document(document, computed_hash):
            return computed_hash, full_path
        raise HTTPException(
            status_code=409,
            detail="Document integrity verification failed. The stored file no longer matches the blockchain record.",
        )

    return computed_hash, full_path


@router.post("/document-requests/")
async def create_document_request(payload: DocumentRequestCreate, current_user: dict = Depends(_require_auth)) -> dict:
    client = get_motor_client()
    user_id = current_user.get("sub")
    profile = await _find_profile_by_user(client, user_id)
    if not profile:
        raise HTTPException(status_code=400, detail="Complete alumni profile first before requesting documents")

    normalized_document_type = normalize_document_type(payload.document_type)
    if not is_supported_document_type(normalized_document_type):
        raise HTTPException(status_code=400, detail="Unsupported document type")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user_id),
        "document_type": normalized_document_type,
        "purpose": payload.purpose,
        "status": "pending",
        "admin_notes": None,
        "rejection_reason": None,
        "generated_document_id": None,
        "source_document_id": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await document_requests_collection(client).insert_one(doc)
    saved = await document_requests_collection(client).find_one({"_id": result.inserted_id})
    return _serialize_request(saved)


@router.get("/document-requests/")
async def get_document_requests(status: str | None = None, current_user: dict = Depends(_require_auth)) -> list[dict]:
    client = get_motor_client()
    query = {"user_id": ObjectId(current_user.get("sub"))}
    if status:
        query["status"] = status
    cursor = document_requests_collection(client).find(query).sort("created_at", -1)
    return [_serialize_request(doc) async for doc in cursor]


@router.get("/document-requests/{request_id}")
async def get_document_request(request_id: str, current_user: dict = Depends(_require_auth)) -> Any:
    if request_id == "admin":
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        return await get_all_document_requests(status=None, current_user=current_user)

    object_id = _object_id(request_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Request not found")
    client = get_motor_client()
    request = await document_requests_collection(client).find_one({"_id": object_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if not current_user.get("is_admin") and str(request.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to access this request")
    return await _enrich_request(client, request)


@router.get("/document-requests/admin")
async def get_all_document_requests(status: str | None = None, current_user: dict = Depends(_require_auth)) -> list[dict]:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    client = get_motor_client()
    query = {}
    if status:
        query["status"] = status
    cursor = document_requests_collection(client).find(query).sort("created_at", -1)
    enriched = []
    async for request in cursor:
        enriched.append(await _enrich_request(client, request))
    return enriched


@router.put("/document-requests/{request_id}/update")
async def update_document_request(request_id: str, payload: DocumentRequestUpdate, current_user: dict = Depends(_require_auth)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    object_id = _object_id(request_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Request not found")
    client = get_motor_client()
    update_data = {
        "status": payload.status,
        "admin_notes": payload.admin_notes,
        "rejection_reason": payload.rejection_reason,
        "updated_at": datetime.now(timezone.utc),
    }
    await document_requests_collection(client).update_one({"_id": object_id}, {"$set": update_data})
    updated = await document_requests_collection(client).find_one({"_id": object_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Request not found")
    return await _enrich_request(client, updated)


@router.post("/document-requests/{request_id}/generate")
async def generate_document(request_id: str, current_user: dict = Depends(_require_auth)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    object_id = _object_id(request_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Request not found")
    client = get_motor_client()
    requests = document_requests_collection(client)
    request = await requests.find_one({"_id": object_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    document = await _resolve_uploaded_document(client, request)
    computed_hash, _full_path = await _verify_document_release_integrity(document)
    now = datetime.now(timezone.utc)
    await requests.update_one(
        {"_id": object_id},
        {
            "$set": {
                "status": "completed",
                "generated_document_id": document["_id"],
                "document_id": document["_id"],
                "source_document_id": document["_id"],
                "released_document_hash": computed_hash,
                "released_at": now,
                "updated_at": now,
            }
        },
    )
    return {
        "document_id": str(document["_id"]),
        "success": True,
        "status": "VERIFIED",
        "document_type": document.get("document_type"),
        "file_name": document.get("file_name"),
    }


@router.get("/document-requests/{request_id}/download")
async def download_generated_document(request_id: str, current_user: dict = Depends(_require_auth)) -> FileResponse:
    object_id = _object_id(request_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Request not found")
    client = get_motor_client()
    request = await document_requests_collection(client).find_one({"_id": object_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if not current_user.get("is_admin") and str(request.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to download this document")

    if request.get("status") != "completed":
        raise HTTPException(status_code=409, detail="This request is not ready for download yet")

    document_id = request.get("generated_document_id") or request.get("document_id")
    if not document_id:
        raise HTTPException(status_code=404, detail="Released document not found")

    resolved_document_id = document_id if isinstance(document_id, ObjectId) else _object_id(str(document_id))
    if resolved_document_id is None:
        raise HTTPException(status_code=404, detail="Released document reference is invalid")

    document = await documents_collection(client).find_one({"_id": resolved_document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Released document not found")

    computed_hash, full_path = await _verify_document_release_integrity(document)
    await document_requests_collection(client).update_one(
        {"_id": object_id},
        {"$set": {"last_download_verified_hash": computed_hash, "last_download_verified_at": datetime.now(timezone.utc)}},
    )

    return FileResponse(
        full_path,
        media_type=document.get("mime_type") or "application/octet-stream",
        filename=document.get("file_name") or f"document-{request_id}",
    )
