from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.db.collections import alumni_profiles_collection, document_requests_collection, documents_collection, users_collection
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


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
    for key in ("user_id", "document_id", "generated_document_id"):
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
    return result


def _simple_pdf_bytes(lines: list[str]) -> bytes:
    escaped = "\\n".join(line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines)
    content = f"BT /F1 12 Tf 50 780 Td ({escaped}) Tj ET"
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
        f"4 0 obj << /Length {len(content)} >> stream\n{content}\nendstream endobj".encode("ascii", errors="ignore"),
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj + b"\n"
    xref_offset = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii")
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("ascii")
    return pdf


@router.post("/document-requests/")
async def create_document_request(payload: DocumentRequestCreate, current_user: dict = Depends(_require_auth)) -> dict:
    client = get_motor_client()
    user_id = current_user.get("sub")
    profile = await _find_profile_by_user(client, user_id)
    if not profile:
        raise HTTPException(status_code=400, detail="Complete alumni profile first before requesting documents")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user_id),
        "document_type": payload.document_type,
        "purpose": payload.purpose,
        "status": "pending",
        "admin_notes": None,
        "rejection_reason": None,
        "generated_document_id": None,
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
    docs = documents_collection(client)
    request = await requests.find_one({"_id": object_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    user = await users_collection(client).find_one({"_id": request.get("user_id")}, {"full_name": 1, "email": 1})
    profile = await alumni_profiles_collection(client).find_one({"user_id": request.get("user_id")}, {"student_id": 1, "course": 1, "graduation_year": 1})
    now = datetime.now(timezone.utc)
    filename = f"generated_request_{request_id}.pdf"
    relative_path = f"uploads/{filename}"
    full_path = Path(__file__).resolve().parents[3] / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_bytes = _simple_pdf_bytes(
        [
            f"Document Request: {request.get('document_type')}",
            f"Name: {(user or {}).get('full_name', 'Unknown')}",
            f"Email: {(user or {}).get('email', 'Unknown')}",
            f"Student ID: {(profile or {}).get('student_id', 'N/A')}",
            f"Course: {(profile or {}).get('course', 'N/A')}",
            f"Purpose: {request.get('purpose') or 'N/A'}",
            f"Generated At: {now.isoformat()}",
        ]
    )
    full_path.write_bytes(pdf_bytes)

    document = {
        "user_id": request.get("user_id"),
        "alumni_profile_id": (await _find_profile_by_user(client, str(request.get("user_id")))).get("_id") if await _find_profile_by_user(client, str(request.get("user_id"))) else None,
        "document_type": request.get("document_type"),
        "title": f"Generated {request.get('document_type')}",
        "description": request.get("purpose"),
        "file_path": relative_path,
        "file_name": filename,
        "mime_type": "application/pdf",
        "file_size": len(pdf_bytes),
        "status": "approved",
        "verification_status": "verified",
        "uploaded_at": now,
        "created_at": now,
        "updated_at": now,
    }
    insert_result = await docs.insert_one(document)
    await requests.update_one(
        {"_id": object_id},
        {
            "$set": {
                "status": "completed",
                "generated_document_id": insert_result.inserted_id,
                "document_id": insert_result.inserted_id,
                "updated_at": now,
            }
        },
    )
    return {"document_id": str(insert_result.inserted_id), "success": True}


@router.get("/document-requests/{request_id}/download")
async def download_generated_document(request_id: str, current_user: dict = Depends(_require_auth)) -> Response:
    object_id = _object_id(request_id)
    if object_id is None:
        raise HTTPException(status_code=404, detail="Request not found")
    client = get_motor_client()
    request = await document_requests_collection(client).find_one({"_id": object_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if not current_user.get("is_admin") and str(request.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to download this document")

    document_id = request.get("generated_document_id") or request.get("document_id")
    if not document_id:
        raise HTTPException(status_code=404, detail="Generated document not found")

    document = await documents_collection(client).find_one({"_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Generated document not found")

    full_path = Path(__file__).resolve().parents[3] / document.get("file_path")
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Generated file not found")

    return FileResponse(
        full_path,
        media_type=document.get("mime_type") or "application/octet-stream",
        filename=document.get("file_name") or f"document-{request_id}.pdf",
    )
