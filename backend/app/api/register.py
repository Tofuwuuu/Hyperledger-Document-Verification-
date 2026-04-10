import logging
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.config import settings
from app.db.session import get_motor_client

logger = logging.getLogger(__name__)

router = APIRouter()


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _safe_user_payload(user_doc: dict) -> dict:
    return {
        "id": str(user_doc.get("_id", "")),
        "email": user_doc.get("email"),
        "full_name": user_doc.get("full_name"),
        "student_id": user_doc.get("student_id"),
        "graduation_year": user_doc.get("graduation_year"),
        "is_admin": bool(user_doc.get("is_admin", False)),
        "is_verified": bool(user_doc.get("is_verified", False)),
    }


def _password_matches(plain_password: str, stored_hash: object) -> bool:
    """Return True if the password matches. Invalid bcrypt data yields False (no 500)."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            str(stored_hash).encode("utf-8"),
        )
    except ValueError:
        logger.warning("Stored password_hash is not valid bcrypt; treating as mismatch")
        return False


def _users_collection(client):
    try:
        db = client.get_default_database()
    except Exception:
        db = client["cvsu_alumni"]
    return db["users"]


@router.post("/auth/register")
async def register_user(payload: RegisterRequest) -> dict:
    logger.info(f"Registration attempt for email: {payload.email}")
    
    if payload.password != payload.confirm_password:
        logger.warning(f"Password mismatch for email: {payload.email}")
        raise HTTPException(status_code=400, detail="Passwords do not match")

    normalized = _normalize_email(str(payload.email))
    logger.info(f"Normalized email: {normalized}")

    client = get_motor_client()
    logger.info(f"MongoDB client connected to: {settings.mongodb_ping_url}")
    
    users = _users_collection(client)
    logger.info(f"Using database: cvsu_alumni, collection: users")

    try:
        existing = await users.find_one({"email": normalized})
        if existing:
            logger.warning(f"Email already registered: {normalized}")
            raise HTTPException(status_code=400, detail="Email already registered")

        pw_hash: bytes = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt())

        doc = {
            "full_name": payload.full_name,
            "email": normalized,
            "password_hash": pw_hash.decode("utf-8"),
            "is_admin": False,
            "is_verified": False,
            "created_at": datetime.now(timezone.utc),
        }
        logger.info(f"Inserting user document: {doc}")

        result = await users.insert_one(doc)
        merged = {**doc, "_id": result.inserted_id}
        logger.info(f"User registered successfully with ID: {result.inserted_id}")
        
    except HTTPException:
        raise
    except DuplicateKeyError:
        logger.error(f"Duplicate key error for email: {normalized}")
        raise HTTPException(status_code=400, detail="Email already registered")
    except PyMongoError as e:
        logger.exception(f"MongoDB error during registration: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Ensure MongoDB is running and MONGODB_URL is correct.",
        )

    return {"success": True, "user": _safe_user_payload(merged)}


@router.post("/auth/login")
async def login_user(payload: LoginRequest) -> dict:
    client = get_motor_client()
    users = _users_collection(client)
    normalized = _normalize_email(str(payload.email))

    try:
        user = await users.find_one({"email": normalized})
    except PyMongoError:
        logger.exception("MongoDB error during login")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Ensure MongoDB is running and MONGODB_URL is correct.",
        )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="No account found for this email. Please register first.",
        )

    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=401, detail="Account password is not set.")

    if not _password_matches(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    return {"success": True, "user": _safe_user_payload(user)}
