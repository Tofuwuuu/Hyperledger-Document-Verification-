from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.db.collections import documents_collection, get_default_db
from app.db.session import get_motor_client
from app.services.blockchain_manager import get_blockchain_manager
from app.utils.auth import get_current_user

router = APIRouter()


class VerifyPayload(BaseModel):
    document_id: str | None = None
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
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required to store blockchain proof")

    object_id = _object_id(payload.document_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")

    client = get_motor_client()
    doc = await documents_collection(client).find_one({"_id": object_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    now = datetime.now(timezone.utc)
    file_hash = payload.hash or doc.get("file_hash")
    if not file_hash:
        raise HTTPException(status_code=400, detail="Document hash is required")

    blockchain_result = await get_blockchain_manager().store_document(payload.document_id, file_hash, payload.metadata)
    if not blockchain_result.get("success"):
        raise HTTPException(status_code=502, detail=blockchain_result.get("message", "Blockchain storage failed"))

    chain_record = {
        "document_id": str(object_id),
        "hash": file_hash,
        "metadata": payload.metadata,
        "transaction_id": blockchain_result.get("transaction_id"),
        "stored_by": str(current_user.get("sub")),
        "stored_at": now,
    }
    db = get_default_db(client)
    await db["verification_requests"].insert_one(chain_record)
    await documents_collection(client).update_one(
        {"_id": object_id},
        {
            "$set": {
                "file_hash": file_hash,
                "blockchain_hash": file_hash,
                "blockchain_tx_id": blockchain_result.get("transaction_id"),
                "blockchain_recorded_at": blockchain_result.get("timestamp") or now.isoformat(),
                "verification_status": "verified",
                "status": "approved",
                "updated_at": now,
            }
        },
    )
    return {
        "success": True,
        "verified": True,
        "status": "VERIFIED",
        "message": "Document stored on blockchain ledger",
        "transaction_id": blockchain_result.get("transaction_id"),
        "metadata": chain_record,
    }


@router.post("/verification/blockchain/verify")
async def verify_document_on_blockchain(payload: VerifyPayload) -> dict:
    if payload.document_id:
        object_id = _object_id(payload.document_id)
        if object_id is None:
            raise HTTPException(status_code=400, detail="Invalid document_id")
        client = get_motor_client()
        doc = await documents_collection(client).find_one({"_id": object_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        result = await get_blockchain_manager().verify_document(payload.document_id, payload.hash)
    else:
        result = await get_blockchain_manager().verify_hash(payload.hash)

    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("message", "Blockchain verification failed"))

    verified = bool(result.get("verified", False))
    return {
        "success": True,
        "verified": verified,
        "status": "VERIFIED" if verified else "FAKE",
        "message": "Hash verified against blockchain ledger" if verified else "Hash does not match blockchain ledger",
        "metadata": result.get("record"),
    }


@router.post("/verification/blockchain/verify-file")
async def verify_file_on_blockchain(document_id: str | None = Form(default=None), file: UploadFile = File(...)) -> dict:
    content = await file.read()
    uploaded_hash = _hex_digest(content)

    if document_id:
        object_id = _object_id(document_id)
        if object_id is None:
            raise HTTPException(status_code=400, detail="Invalid document_id")
        client = get_motor_client()
        doc = await documents_collection(client).find_one({"_id": object_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        result = await get_blockchain_manager().verify_document(document_id, uploaded_hash)
    else:
        result = await get_blockchain_manager().verify_hash(uploaded_hash)

    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("message", "Blockchain verification failed"))

    verified = bool(result.get("verified", False))
    return {
        "success": True,
        "verified": verified,
        "status": "VERIFIED" if verified else "FAKE",
        "message": "File verified against blockchain ledger" if verified else "File hash mismatch",
        "metadata": {
            "document_id": document_id,
            "uploaded_hash": uploaded_hash,
            "blockchain_record": result.get("record"),
        },
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
    result = await get_blockchain_manager().get_document_history(document_id)
    if result.get("success"):
        return {"document_id": document_id, "history": result.get("history", [])}

    cursor = get_default_db(client)["verification_requests"].find({"document_id": document_id}).sort("stored_at", -1)
    items = [item async for item in cursor]
    for item in items:
        item["_id"] = str(item["_id"])
    return {"document_id": document_id, "history": items}
