from __future__ import annotations

import logging
from datetime import datetime, timezone

from pymongo import ASCENDING

from app.db.collections import (
    alumni_profiles_collection,
    event_registrations_collection,
    events_collection,
    users_collection,
)
from app.db.session import get_motor_client

logger = logging.getLogger(__name__)

PROFILE_FIELDS = {
    "full_name",
    "student_id",
    "phone",
    "graduation_year",
    "batch",
    "course",
    "department",
    "sex",
    "civil_status",
    "birthday",
    "region_of_origin",
    "address",
    "bio",
    "profile_picture",
    "current_job",
    "current_employer",
}


def _extract_profile_data(user_doc: dict) -> dict:
    profile = {
        key: user_doc.get(key)
        for key in PROFILE_FIELDS
        if user_doc.get(key) not in (None, "")
    }
    if user_doc.get("email"):
        profile["email"] = str(user_doc["email"]).strip().lower()
    return profile


async def initialize_database() -> None:
    client = get_motor_client()
    users = users_collection(client)
    profiles = alumni_profiles_collection(client)
    events = events_collection(client)
    registrations = event_registrations_collection(client)
    now = datetime.now(timezone.utc)
    async def _ensure_index(coll, keys, name: str, unique: bool = False) -> None:
        try:
            existing = await coll.index_information()
            # index_information returns a dict mapping index name -> spec
            # each spec has a 'key' value like [(field, direction), ...]
            for existing_name, info in existing.items():
                if info.get("key") == keys and existing_name != name:
                    try:
                        await coll.drop_index(existing_name)
                        logger.info("Dropped conflicting index %s on %s", existing_name, coll.name)
                    except Exception:
                        logger.exception("Failed dropping conflicting index %s on %s", existing_name, coll.name)
                    break
            await coll.create_index(keys, name=name, unique=unique)
        except Exception:
            logger.exception("Failed creating MongoDB index %s on %s", name, coll.name)

    await _ensure_index(users, [("email", ASCENDING)], "idx_users_email")
    await _ensure_index(users, [("is_verified", ASCENDING)], "idx_users_is_verified")
    await _ensure_index(users, [("is_admin", ASCENDING)], "idx_users_is_admin")
    await _ensure_index(profiles, [("user_id", ASCENDING)], "uq_alumni_profiles_user_id", unique=True)
    await _ensure_index(profiles, [("student_id", ASCENDING)], "idx_alumni_profiles_student_id")
    await _ensure_index(profiles, [("graduation_year", ASCENDING)], "idx_alumni_profiles_graduation_year")
    await _ensure_index(events, [("start_date", ASCENDING)], "idx_events_start_date")
    await _ensure_index(events, [("is_active", ASCENDING)], "idx_events_is_active")
    await _ensure_index(registrations, [("event_id", ASCENDING)], "idx_event_reg_event_id")
    await _ensure_index(registrations, [("user_id", ASCENDING)], "idx_event_reg_user_id")

    migrated_count = 0
    normalized_count = 0

    try:
        async for user in users.find({}):
            update_data: dict = {}

            email = user.get("email")
            if email:
                normalized_email = str(email).strip().lower()
                if normalized_email != email:
                    update_data["email"] = normalized_email

            if not user.get("password_hash") and user.get("hashed_password"):
                update_data["password_hash"] = user["hashed_password"]

            if update_data:
                update_data["updated_at"] = now
                await users.update_one({"_id": user["_id"]}, {"$set": update_data})
                normalized_count += 1

            profile_data = _extract_profile_data({**user, **update_data})
            if not profile_data:
                continue

            profile_data["user_id"] = user["_id"]
            profile_data["updated_at"] = now
            await profiles.update_one(
                {"user_id": user["_id"]},
                {"$set": profile_data, "$setOnInsert": {"created_at": user.get("created_at", now)}},
                upsert=True,
            )
            migrated_count += 1
    except Exception:
        logger.exception("Failed MongoDB normalization/migration bootstrap")
        return

    logger.info(
        "Mongo bootstrap complete: normalized %s user docs, upserted %s alumni profile docs",
        normalized_count,
        migrated_count,
    )
