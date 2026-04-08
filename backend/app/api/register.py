from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.session import get_motor_client

import bcrypt


router = APIRouter()


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    full_name: str = Field(min_length=2, max_length=200)
    student_id: str = Field(min_length=1, max_length=50)
    graduation_year: int = Field(ge=1900, le=2100)
    password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


@router.post("/auth/register")
async def register_user(payload: RegisterRequest) -> dict:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    client = get_motor_client()

    try:
        db = client.get_default_database()
    except Exception:
        # Fallback if the URI didn't include a default database name.
        db = client["cvsu_alumni"]

    users = db["users"]

    existing_by_email = await users.find_one({"email": payload.email})
    if existing_by_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_by_student_id = await users.find_one({"student_id": payload.student_id})
    if existing_by_student_id:
        raise HTTPException(status_code=400, detail="Student ID already registered")

    pw_hash: bytes = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt())

    doc = {
        "email": payload.email,
        "full_name": payload.full_name,
        "student_id": payload.student_id,
        "graduation_year": payload.graduation_year,
        # Store as a UTF-8 string so it can be serialized cleanly later.
        "password_hash": pw_hash.decode("utf-8"),
        "is_admin": False,
        "is_verified": False,
    }

    await users.insert_one(doc)

    return {"success": True}

