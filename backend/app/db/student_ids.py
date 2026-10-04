"""Student ID normalization and the unique index on alumni_profiles.student_id.

Every save path stores student IDs normalized (trimmed, uppercased), and the
uniqueness check, the startup index check, and the cleanup script all compare
the same normalized form, so "ab-123" and "AB-123 " are the same ID.
"""
from __future__ import annotations

import logging
from typing import Any, Iterable

from pymongo import ASCENDING

logger = logging.getLogger(__name__)

UNIQUE_INDEX_NAME = "uq_alumni_profiles_student_id"
LEGACY_INDEX_NAME = "idx_alumni_profiles_student_id"
# Only non-empty strings are indexed, so many profiles may leave it blank.
PARTIAL_FILTER = {"student_id": {"$type": "string", "$gt": ""}}


def normalize_student_id(value: Any) -> Any:
    """Trim and uppercase a string student ID. Non-strings are returned as-is."""
    if isinstance(value, str):
        return value.strip().upper()
    return value


def find_duplicate_groups(docs: Iterable[dict[str, Any]]) -> dict[str, list[str]]:
    """Group profile ids by normalized student ID; return only groups with 2+ profiles."""
    groups: dict[str, list[str]] = {}
    for doc in docs:
        normalized = normalize_student_id(doc.get("student_id"))
        if not isinstance(normalized, str) or not normalized:
            continue
        groups.setdefault(normalized, []).append(str(doc.get("_id")))
    return {student_id: ids for student_id, ids in groups.items() if len(ids) > 1}


async def _existing_index_names(profiles: Any) -> set[str]:
    try:
        return set((await profiles.index_information()).keys())
    except Exception:
        return set()


async def ensure_student_id_index(profiles: Any) -> bool:
    """Create the unique partial index on student_id if it's safe (idempotent).

    Duplicates are checked on normalized values first. If any exist, log the
    conflicting student IDs and profile ids, keep the old non-unique index, and
    return False instead of failing startup.
    """
    try:
        docs = [doc async for doc in profiles.find({"student_id": {"$type": "string"}}, {"student_id": 1})]
        duplicates = find_duplicate_groups(docs)
        if duplicates:
            listing = "; ".join(f"{sid}: profiles {', '.join(ids)}" for sid, ids in sorted(duplicates.items()))
            logger.error(
                "Not creating unique index %s: %d student ID(s) are shared by more than one profile "
                "(compared trimmed and uppercased). Resolve them manually, see backend/scripts/"
                "normalize_student_ids.py. Conflicts: %s",
                UNIQUE_INDEX_NAME,
                len(duplicates),
                listing,
            )
            if LEGACY_INDEX_NAME not in await _existing_index_names(profiles):
                await profiles.create_index([("student_id", ASCENDING)], name=LEGACY_INDEX_NAME)
            return False

        names = await _existing_index_names(profiles)
        if UNIQUE_INDEX_NAME not in names:
            # The unique index replaces the plain one on the same key.
            if LEGACY_INDEX_NAME in names:
                await profiles.drop_index(LEGACY_INDEX_NAME)
            await profiles.create_index(
                [("student_id", ASCENDING)],
                name=UNIQUE_INDEX_NAME,
                unique=True,
                partialFilterExpression=PARTIAL_FILTER,
            )
            logger.info("Created unique index %s", UNIQUE_INDEX_NAME)
        return True
    except Exception:
        logger.exception("Failed ensuring unique index %s", UNIQUE_INDEX_NAME)
        return False
