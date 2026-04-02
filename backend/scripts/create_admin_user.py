import asyncio
import sys
from datetime import datetime
from pathlib import Path


def _ensure_import_path() -> None:
    """
    Allow running this script from repo root or backend/.
    """
    here = Path(__file__).resolve()
    backend_dir = here.parents[1]  # .../backend
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


_ensure_import_path()

from bson import ObjectId  # noqa: E402
from app.config.database import connect_to_mongo, get_database  # noqa: E402
from app.utils.auth import get_password_hash  # noqa: E402


EMAIL = "admin@gmail.com"
PASSWORD = "admin"
FULL_NAME = "Admin"


async def main() -> None:
    ok = await connect_to_mongo()
    if not ok:
        raise SystemExit("MongoDB connection failed. Ensure mongodb is running and MONGODB_URL is correct.")

    db = get_database()
    now = datetime.utcnow()

    existing = await db.users.find_one({"email": EMAIL})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "full_name": existing.get("full_name") or FULL_NAME,
                    "hashed_password": get_password_hash(PASSWORD),
                    "is_active": True,
                    "is_admin": True,
                    "is_verified": True,
                    "verification_pending": False,
                    "updated_at": now,
                }
            },
        )
        user_id = existing["_id"]
        print(f"Updated existing admin user: {EMAIL} (id={user_id})")
    else:
        user_id = str(ObjectId())
        await db.users.insert_one(
            {
                "_id": user_id,
                "email": EMAIL,
                "full_name": FULL_NAME,
                "hashed_password": get_password_hash(PASSWORD),
                "is_active": True,
                "is_admin": True,
                "student_id": None,
                "graduation_year": None,
                "created_at": now,
                "updated_at": now,
                "is_verified": True,
                "verification_pending": False,
            }
        )
        print(f"Created admin user: {EMAIL} (id={user_id})")

    alumni = await db.alumni.find_one({"user_id": str(user_id)})
    if not alumni:
        await db.alumni.insert_one(
            {
                "_id": str(ObjectId()),
                "user_id": str(user_id),
                "email": EMAIL,
                "full_name": FULL_NAME,
                "student_id": None,
                "graduation_year": None,
                "created_at": now,
                "updated_at": now,
                "profile_completed": True,
            }
        )
        print("Created alumni profile placeholder for admin user.")

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())

