"""Fabric Gateway HTTP client for Hyperledger Fabric integration."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class FabricClient:
    """
    Client for interacting with the local Node Fabric Gateway service.
    """

    def __init__(self, connection_profile_path: str | None = None, channel_name: str | None = None):
        """Initialize Fabric client."""
        self.config_path = connection_profile_path or "app/config/fabric/connection-profile.json"
        self.channel_name = channel_name or "alumni-channel"
        self.gateway_url = os.getenv("FABRIC_GATEWAY_URL", "http://localhost:3001").rstrip("/")
        self.connected = False
        logger.info("Initializing FabricClient with gateway: %s", self.gateway_url)

    async def connect(self) -> bool:
        """Connect to Fabric network."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.gateway_url}/health")
                response.raise_for_status()
            self.connected = True
            return True
        except Exception:
            logger.exception("Could not connect to Fabric Gateway at %s", self.gateway_url)
            self.connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from Fabric network."""
        logger.info("Disconnecting from Fabric network (placeholder)")
        self.connected = False

    async def store_document(self, document_id: str, hash_value: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Store document hash on blockchain."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.gateway_url}/documents",
                json={"document_id": document_id, "hash": hash_value, "metadata": metadata or {}},
            )
            response.raise_for_status()
            return response.json()

    async def verify_document(self, document_id: str, hash_value: str) -> dict[str, Any]:
        """Verify document hash against blockchain."""
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.gateway_url}/documents/verify",
                json={"document_id": document_id, "hash": hash_value},
            )
            response.raise_for_status()
            return response.json()

    async def verify_hash(self, hash_value: str) -> dict[str, Any]:
        """Verify a document hash without a document ID."""
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(f"{self.gateway_url}/hashes/verify", json={"hash": hash_value})
            response.raise_for_status()
            return response.json()

    async def get_history(self, document_id: str) -> dict[str, Any]:
        """Get document history from blockchain."""
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{self.gateway_url}/documents/{document_id}/history")
            response.raise_for_status()
            return response.json()

    def calculate_document_hash(self, content: bytes) -> str:
        """Calculate document hash."""
        import hashlib

        return hashlib.sha256(content).hexdigest()
