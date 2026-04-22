from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.db.collections import documents_collection, get_default_db
from app.db.session import get_motor_client
from app.utils.auth import get_current_user

router = APIRouter()


class VerifyPayload(BaseModel):
    document_id: str
    hash: str


class StorePayload(BaseModel):
    document_id: str
    hash: str
    metadata: dict[str, Any] = {}


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


def _hex_digest(raw: bytes) -> str:
    return sha256(raw).hexdigest()


@router.post("/verification/blockchain/store")
async def store_document_on_blockchain(payload: StorePayload, current_user: dict = Depends(get_current_user)) -> dict:
    object_id = _object_id(payload.document_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")

    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.get("is_admin") and str(doc.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to store this document")

    now = datetime.now(timezone.utc)
    chain_record = {
        "document_id": str(object_id),
        "hash": payload.hash,
        "metadata": payload.metadata,
        "stored_by": str(current_user.get("sub")),
        "stored_at": now,
    }
    db = get_default_db(client)
    await db["verification_requests"].insert_one(chain_record)
    await documents_collection(client).update_one(
        {"_id": object_id},
        {"$set": {"blockchain_hash": payload.hash, "verification_status": "verified", "updated_at": now}},
    )
    return {"success": True, "verified": True, "message": "Document stored on blockchain ledger", "metadata": chain_record}


@router.post("/verification/blockchain/verify")
async def verify_document_on_blockchain(payload: VerifyPayload) -> dict:
    object_id = _object_id(payload.document_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    stored_hash = doc.get("blockchain_hash")
    verified = bool(stored_hash and str(stored_hash) == str(payload.hash))
    return {
        "success": True,
        "verified": verified,
        "message": "Hash verified against blockchain ledger" if verified else "Hash does not match blockchain ledger",
        "metadata": {"document_id": payload.document_id, "stored_hash": stored_hash},
    }


@router.post("/verification/blockchain/verify-file")
async def verify_file_on_blockchain(document_id: str = Form(...), file: UploadFile = File(...)) -> dict:
    object_id = _object_id(document_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    content = await file.read()
    uploaded_hash = _hex_digest(content)
    stored_hash = doc.get("blockchain_hash")
    verified = bool(stored_hash and str(stored_hash) == uploaded_hash)
    return {
        "success": True,
        "verified": verified,
        "message": "File verified against blockchain ledger" if verified else "File hash mismatch",
        "metadata": {"document_id": document_id, "uploaded_hash": uploaded_hash, "stored_hash": stored_hash},
    }


@router.get("/verification/blockchain/history/{document_id}")
async def get_blockchain_history(document_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    object_id = _object_id(document_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.get("is_admin") and str(doc.get("user_id")) != str(current_user.get("sub")):
        raise HTTPException(status_code=403, detail="Not allowed to view this history")
    cursor = get_default_db(client)["verification_requests"].find({"document_id": document_id}).sort("stored_at", -1)
    items = [item async for item in cursor]
    for item in items:
        item["_id"] = str(item["_id"])
    return {"document_id": document_id, "history": items}
