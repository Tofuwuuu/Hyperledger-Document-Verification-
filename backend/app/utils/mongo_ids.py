from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection


async def find_one_by_id(
    collection: AsyncIOMotorCollection,
    id_value: str,
    extra_filter: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Find a document by _id when storage may be ObjectId or string."""
    if not id_value:
        return None

    base_filter = dict(extra_filter or {})
    try:
        doc = await collection.find_one({**base_filter, "_id": ObjectId(id_value)})
        if doc is not None:
            return doc
    except Exception:
        pass

    return await collection.find_one({**base_filter, "_id": id_value})
