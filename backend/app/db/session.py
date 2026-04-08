from __future__ import annotations

from functools import lru_cache
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings


@lru_cache(maxsize=1)
def get_motor_client() -> AsyncIOMotorClient:
    # Keep a short selection timeout so health endpoints return quickly.
    return AsyncIOMotorClient(
        settings.mongodb_ping_url,
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000,
    )


async def mongo_ping() -> bool:
    client = get_motor_client()
    try:
        result: Any = await client.admin.command("ping")
        return bool(result)  # "ok": 1 is a truthy response
    except Exception:
        return False
