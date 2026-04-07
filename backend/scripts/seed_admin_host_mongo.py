import asyncio
from datetime import datetime
from pathlib import Path
import sys
import hashlib
import os


def _ensure_import_path() -> None:
    here = Path(__file__).resolve()
    backend_dir = here.parents[1]  # .../backend
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


_ensure_import_path()

from app.config.database import connect_to_mongo, get_database  # noqa: E402


EMAIL = os.getenv("SEED_ADMIN_EMAIL", "admin@gmail.com")
FULL_NAME = os.getenv("SEED_ADMIN_FULL_NAME", "Admin User")
PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "adminadmin61234")


def make_sha256_hash(password: str) -> str:
    """
    Create a sha256$<salt>$<hash> style password that backend.verify_password understands.
    """
    salt = "static_salt_seed_admin"  # fine for local/dev seeding
    digest = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return f"sha256${salt}${digest}"


async def main() -> None:
    ok = await connect_to_mongo()
    if not ok:
        raise SystemExit("MongoDB connection failed. Is localhost Mongo running?")

    db = get_database()
    now = datetime.utcnow()

    hashed_password = make_sha256_hash(PASSWORD)

    # Upsert user record
    user = await db.users.find_one({"email": EMAIL})
    if user:
        user_id = user.get("_id")
        await db.users.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "email": EMAIL,
                    "full_name": FULL_NAME,
                    "hashed_password": hashed_password,
                    "is_active": True,
                    "is_admin": True,
                    "is_verified": True,
                    "verification_pending": False,
                    "updated_at": now,
                }
            },
        )
        print(f"Updated existing admin user in host Mongo: {EMAIL} (id={user_id})")
    else:
        # Minimal fields consistent with existing login usage
        doc = {
            "email": EMAIL,
            "full_name": FULL_NAME,
            "hashed_password": hashed_password,
            "is_active": True,
            "is_admin": True,
            "is_verified": True,
            "verification_pending": False,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.users.insert_one(doc)
        user_id = result.inserted_id
        print(f"Created admin user in host Mongo: {EMAIL} (id={user_id})")

    # Ensure a simple alumni placeholder exists for this user (if schema is used later)
    alumni = await db.alumni.find_one({"email": EMAIL})
    if not alumni:
        alumni_doc = {
            "user_id": str(user_id),
            "email": EMAIL,
            "full_name": FULL_NAME,
            "student_id": "ADMIN-0000",
            "graduation_year": datetime.utcnow().year,
            "created_at": now,
            "updated_at": now,
            "profile_completed": True,
        }
        await db.alumni.insert_one(alumni_doc)
        print("Created alumni placeholder for admin user in host Mongo.")

    print("Done seeding host Mongo admin user.")


if __name__ == "__main__":
    asyncio.run(main())

