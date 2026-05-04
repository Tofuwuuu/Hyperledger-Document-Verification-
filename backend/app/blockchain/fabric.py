"""Hyperledger Fabric integration utilities."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from itertools import count
from typing import Any

logger = logging.getLogger(__name__)

_mock_documents: dict[str, dict[str, Any]] = {}
_mock_hash_index: dict[str, dict[str, Any]] = {}
_mock_history: dict[str, list[dict[str, Any]]] = {}
_tx_counter = count(1)


def initialize_fabric_client() -> None:
    """Initialize the mock Fabric client."""
    logger.info("Initializing Fabric client")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_tx_id(document_id: str, hash_value: str) -> str:
    return f"mocktx-{next(_tx_counter)}-{document_id}-{hash_value[:12]}"


async def store_document_hash(document_id: str, hash_value: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Store a document hash in the mock ledger."""
    metadata = metadata or {}
    transaction_id = _next_tx_id(document_id, hash_value)
    stored_at = _now_iso()
    record = {
        "document_id": document_id,
        "hash": hash_value,
        "metadata": metadata,
        "transaction_id": transaction_id,
        "stored_at": stored_at,
    }
    _mock_documents[document_id] = record
    _mock_hash_index[hash_value] = record
    _mock_history.setdefault(document_id, []).append(
        {
            "tx_id": transaction_id,
            "timestamp": stored_at,
            "action": "stored",
            "metadata": metadata,
            "hash": hash_value,
            "document_id": document_id,
        }
    )
    logger.info("Stored document %s in mock ledger", document_id)
    return {
        "success": True,
        "transaction_id": transaction_id,
        "message": "Document stored successfully",
        "record": record,
    }


async def verify_document_hash(document_id: str, hash_value: str) -> dict[str, Any]:
    """Verify a document hash against the mock ledger using its document ID."""
    record = _mock_documents.get(document_id)
    verified = bool(record and record.get("hash") == hash_value)
    return {
        "success": True,
        "verified": verified,
        "message": "Document verified successfully" if verified else "Document hash mismatch",
        "record": record,
    }


async def verify_hash_value(hash_value: str) -> dict[str, Any]:
    """Verify a raw hash against the mock ledger without a document ID."""
    record = _mock_hash_index.get(hash_value)
    verified = record is not None
    return {
        "success": True,
        "verified": verified,
        "message": "Document verified successfully" if verified else "Document hash not found",
        "record": record,
    }


async def get_document_history(document_id: str) -> dict[str, Any]:
    """Return mock blockchain history for a document."""
    return {
        "success": True,
        "history": list(_mock_history.get(document_id, [])),
        "message": "History retrieved successfully",
    }
