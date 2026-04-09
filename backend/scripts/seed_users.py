import os
import random
import time
from datetime import datetime, timezone

import bcrypt
from pymongo import MongoClient


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    count = int(os.getenv("SEED_USERS_COUNT", "10"))
    password = os.getenv("SEED_USERS_PASSWORD", "admin12345")
    is_verified = os.getenv("SEED_USERS_VERIFIED", "false").lower() == "true"

    mongo_url = (
        os.getenv("MONGODB_URL")
        or os.getenv("MONGODB_URI")
        or "mongodb://localhost:27017/cvsu_alumni"
    )

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["cvsu_alumni"]

    users = db["users"]

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    created = []
    base_ts = int(time.time())
    for i in range(count):
        # Make collisions unlikely even if you run this multiple times.
        suffix = f"{base_ts}{i}{random.randint(100,999)}"
        email = f"seed_{suffix}@example.com"
        student_id = f"SEED-{suffix}"

        if users.find_one({"email": email}):
            continue

        now = _utcnow_iso()
        doc = {
            "email": email,
            "full_name": f"Seed User {i + 1}",
            "student_id": student_id,
            "graduation_year": 2026,
            "password_hash": pw_hash,
            "is_admin": False,
            "is_verified": is_verified,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        users.insert_one(doc)
        created.append({"email": email, "student_id": student_id})

    print(f"Inserted {len(created)} users into cvsu_alumni.users")
    for u in created:
        print(f"- {u['email']} ({u['student_id']})")


if __name__ == "__main__":
    main()

