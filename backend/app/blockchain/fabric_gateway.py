import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _post(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=payload) as resp:
            data = await resp.text()
            try:
                parsed = json.loads(data) if data else {}
            except json.JSONDecodeError:
                parsed = {"raw": data}
            if resp.status >= 400:
                return {"success": False, "status": resp.status, "error": parsed}
            return parsed


async def _get(url: str) -> Dict[str, Any]:
    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as resp:
            data = await resp.text()
            try:
                parsed = json.loads(data) if data else {}
            except json.JSONDecodeError:
                parsed = {"raw": data}
            if resp.status >= 400:
                return {"success": False, "status": resp.status, "error": parsed}
            return parsed


def is_gateway_enabled() -> bool:
    return bool(settings.BLOCKCHAIN_ENABLED and settings.FABRIC_GATEWAY_URL)


async def store_document_hash(document_id: str, document_hash: str, metadata: Optional[dict] = None) -> Dict[str, Any]:
    if not is_gateway_enabled():
        return {"success": False, "message": "Fabric gateway disabled"}
    url = settings.FABRIC_GATEWAY_URL.rstrip("/") + "/store"
    result = await _post(url, {"document_id": document_id, "document_hash": document_hash, "metadata": metadata or {}})
    if result.get("ok"):
        return {"success": True, "result": result.get("result")}
    return {"success": False, "message": result.get("error", result)}


async def verify_document_hash(document_id: str, document_hash: str) -> Dict[str, Any]:
    if not is_gateway_enabled():
        return {"success": False, "message": "Fabric gateway disabled"}
    url = settings.FABRIC_GATEWAY_URL.rstrip("/") + "/verify"
    result = await _post(url, {"document_id": document_id, "document_hash": document_hash})
    if result.get("ok"):
        return {"success": True, "verified": bool(result.get("verified"))}
    return {"success": False, "message": result.get("error", result)}


async def get_document_history(document_id: str) -> Dict[str, Any]:
    if not is_gateway_enabled():
        return {"success": False, "message": "Fabric gateway disabled"}
    url = settings.FABRIC_GATEWAY_URL.rstrip("/") + f"/history/{document_id}"
    result = await _get(url)
    if result.get("ok"):
        return {"success": True, "history": result.get("history", [])}
    return {"success": False, "message": result.get("error", result)}

