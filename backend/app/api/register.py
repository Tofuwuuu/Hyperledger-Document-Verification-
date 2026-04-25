import logging
import secrets
from datetime import datetime, timezone

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.config import settings
from app.db.collections import alumni_profiles_collection, users_collection
from app.db.session import get_motor_client
from app.utils.auth import create_access_token, decode_access_token, get_current_user

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


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class VerifyUserRequest(BaseModel):
    notes: str | None = None


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetTokenRequest(BaseModel):
    token: str


class ResetPasswordConfirmRequest(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


class MFASetupRequest(BaseModel):
    type: str = "email"


class MFAEnableRequest(BaseModel):
    verification_code: str = Field(min_length=4, max_length=12)


class SecurityQuestionItem(BaseModel):
    question: str
    answer: str


class SetSecurityQuestionsRequest(BaseModel):
    questions: list[SecurityQuestionItem]


class SecurityAnswerItem(BaseModel):
    question_idx: int
    answer: str


class VerifySecurityQuestionsRequest(BaseModel):
    email: EmailStr
    answers: list[SecurityAnswerItem]


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


async def _load_user_by_subject(client, subject: str) -> dict | None:
    try:
        return await users_collection(client).find_one({"_id": ObjectId(subject)})
    except Exception:
        return None


async def _require_admin_user(current_user: dict) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _canonical_password_hash(user_doc: dict) -> object:
    return user_doc.get("password_hash") or user_doc.get("hashed_password")


def _password_matches(plain_password: str, stored_hash: object) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            str(stored_hash).encode("utf-8"),
        )
    except ValueError:
        logger.warning("Stored password_hash is not valid bcrypt; treating as mismatch")
        return False


async def _find_profile_id(client, user_id: str) -> str | None:
    try:
        profile = await alumni_profiles_collection(client).find_one({"user_id": ObjectId(user_id)}, {"_id": 1})
    except Exception:
        return None
    if not profile:
        return None
    return str(profile["_id"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_token_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return True
    normalized = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    return normalized < _now_utc()


@router.post("/auth/register")
async def register_user(payload: RegisterRequest) -> dict:
    logger.info("Registration attempt for email: %s", payload.email)

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    normalized = _normalize_email(str(payload.email))
    client = get_motor_client()
    users = users_collection(client)

    try:
        existing = await users.find_one({"email": normalized})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        pw_hash: bytes = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt())
        now = datetime.now(timezone.utc)
        doc = {
            "full_name": payload.full_name,
            "email": normalized,
            "password_hash": pw_hash.decode("utf-8"),
            "is_admin": False,
            "is_verified": False,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        result = await users.insert_one(doc)
        merged = {**doc, "_id": result.inserted_id}
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except PyMongoError as exc:
        logger.exception("MongoDB error during registration: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Ensure MongoDB is running and MONGODB_URL is correct.",
        )

    return {"success": True, "user": _safe_user_payload(merged)}


@router.post("/auth/login")
async def login_user(payload: LoginRequest) -> dict:
    client = get_motor_client()
    users = users_collection(client)
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

    password_hash = _canonical_password_hash(user)
    if not password_hash:
        raise HTTPException(status_code=401, detail="Account password is not set.")

    if not _password_matches(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    access_token = create_access_token(user)
    now = datetime.now(timezone.utc)
    await users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now, "updated_at": now}})

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": _safe_user_payload(user),
    }


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    user_id = current_user.get("sub")
    user = await _load_user_by_subject(client, user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    payload = _safe_user_payload(user)
    payload["role"] = "admin" if payload["is_admin"] else "alumni"
    payload["profile_id"] = await _find_profile_id(client, str(user["_id"]))
    return payload


@router.post("/auth/refresh")
async def refresh_token(payload: RefreshRequest) -> dict:
    if not payload.refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    current_user = decode_access_token(payload.refresh_token)
    client = get_motor_client()
    user = await _load_user_by_subject(client, current_user.get("sub", ""))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_token = create_access_token(user)
    return {
        "access_token": new_token,
        "refresh_token": new_token,
        "token_type": "bearer",
    }


@router.post("/auth/logout")
async def logout_user() -> dict:
    return {"success": True}


@router.get("/auth/csrf-token")
async def get_csrf_token() -> dict:
    token = create_access_token({"_id": "csrf", "email": "csrf@local", "is_admin": False, "is_verified": True})
    return {"csrf_token": token}


@router.post("/auth/reset-password")
async def request_password_reset(payload: ResetPasswordRequest) -> dict:
    client = get_motor_client()
    users = users_collection(client)
    normalized = _normalize_email(str(payload.email))
    user = await users.find_one({"email": normalized})
    if not user:
        return {"success": True, "message": "If the email exists, a reset token has been issued."}

    token = create_access_token(user, expires_hours=1)
    expires_at = datetime.fromtimestamp(decode_access_token(token)["exp"], tz=timezone.utc)
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_reset_token": token, "password_reset_expires_at": expires_at, "updated_at": _now_utc()}},
    )
    return {
        "success": True,
        "message": "Reset token issued successfully",
        "reset_token": token,
        "expires_at": expires_at.isoformat(),
    }


@router.post("/auth/verify-reset-token")
async def verify_reset_token(payload: VerifyResetTokenRequest) -> dict:
    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    claims = decode_access_token(token)
    client = get_motor_client()
    user = await _load_user_by_subject(client, str(claims.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found for this token")
    if str(user.get("password_reset_token", "")) != token:
        raise HTTPException(status_code=401, detail="Invalid or outdated reset token")
    if _is_token_expired(user.get("password_reset_expires_at")):
        raise HTTPException(status_code=401, detail="Reset token has expired")
    return {"success": True, "valid": True, "email": user.get("email")}


@router.post("/auth/reset-password-confirm")
async def reset_password_confirm(payload: ResetPasswordConfirmRequest) -> dict:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    claims = decode_access_token(payload.token.strip())
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(claims.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found for this token")
    if str(user.get("password_reset_token", "")) != payload.token:
        raise HTTPException(status_code=401, detail="Invalid or outdated reset token")
    if _is_token_expired(user.get("password_reset_expires_at")):
        raise HTTPException(status_code=401, detail="Reset token has expired")
    new_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": new_hash, "updated_at": _now_utc()},
            "$unset": {"password_reset_token": "", "password_reset_expires_at": ""},
        },
    )
    return {"success": True, "message": "Password has been reset successfully"}


@router.get("/auth/mfa/status")
async def get_mfa_status(current_user: dict = Depends(get_current_user)) -> dict:
    try:
        client = get_motor_client()
        users = users_collection(client)

        normalized = _normalize_email(str(payload.email))

        try:
            user = await users.find_one({"email": normalized})
        except Exception:
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

        password_hash = _canonical_password_hash(user)
        if not password_hash:
            raise HTTPException(status_code=401, detail="Account password is not set.")

        if not _password_matches(payload.password, password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password.")

        access_token = create_access_token(user)
        now = datetime.now(timezone.utc)
        await users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now, "updated_at": now}})

        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": _safe_user_payload(user),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error during login: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error during login")
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if _is_token_expired(user.get("mfa_setup_expires_at")):
        raise HTTPException(status_code=400, detail="MFA setup code expired")
    expected = str(user.get("mfa_setup_code", ""))
    if payload.verification_code.strip() != expected:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"mfa_enabled": True, "updated_at": _now_utc()},
            "$unset": {"mfa_setup_code": "", "mfa_setup_expires_at": ""},
        },
    )
    return {"success": True, "message": "MFA enabled"}


@router.post("/auth/mfa/disable")
async def disable_mfa(current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": False, "updated_at": _now_utc()}})
    return {"success": True, "message": "MFA disabled"}


@router.post("/auth/set-security-questions")
async def set_security_questions(payload: SetSecurityQuestionsRequest, current_user: dict = Depends(get_current_user)) -> dict:
    if len(payload.questions) < 2:
        raise HTTPException(status_code=400, detail="At least 2 security questions are required")
    normalized_questions = [
        {"question": item.question.strip(), "answer_hash": bcrypt.hashpw(item.answer.strip().lower().encode("utf-8"), bcrypt.gensalt()).decode("utf-8")}
        for item in payload.questions
        if item.question.strip() and item.answer.strip()
    ]
    if len(normalized_questions) < 2:
        raise HTTPException(status_code=400, detail="At least 2 valid question/answer pairs are required")
    client = get_motor_client()
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await users_collection(client).update_one(
        {"_id": user["_id"]},
        {"$set": {"security_questions": normalized_questions, "updated_at": _now_utc()}},
    )
    return {"success": True, "message": "Security questions saved"}


@router.get("/auth/security-questions/{email}")
async def get_security_questions(email: str) -> dict:
    normalized = _normalize_email(email)
    user = await users_collection(get_motor_client()).find_one({"email": normalized}, {"security_questions": 1})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    questions = user.get("security_questions") or []
    if len(questions) < 2:
        raise HTTPException(status_code=400, detail="Security questions are not configured for this account")
    return {"questions": [{"index": idx, "question": item.get("question")} for idx, item in enumerate(questions)]}


@router.post("/auth/verify-security-questions")
async def verify_security_questions(payload: VerifySecurityQuestionsRequest) -> dict:
    normalized = _normalize_email(str(payload.email))
    users = users_collection(get_motor_client())
    user = await users.find_one({"email": normalized}, {"security_questions": 1, "email": 1, "is_admin": 1, "is_verified": 1})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    questions = user.get("security_questions") or []
    if len(payload.answers) < 2:
        raise HTTPException(status_code=400, detail="At least 2 security answers are required")
    correct = 0
    for submitted in payload.answers:
        idx = submitted.question_idx
        if idx < 0 or idx >= len(questions):
            continue
        stored_hash = questions[idx].get("answer_hash")
        if not stored_hash:
            continue
        if _password_matches(submitted.answer.strip().lower(), stored_hash):
            correct += 1
    if correct < 2:
        raise HTTPException(status_code=401, detail="Security answers did not match")

    token = create_access_token({"_id": user["_id"], "email": user.get("email"), "is_admin": user.get("is_admin", False), "is_verified": user.get("is_verified", False)}, expires_hours=1)
    expires_at = datetime.fromtimestamp(decode_access_token(token)["exp"], tz=timezone.utc)
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_reset_token": token, "password_reset_expires_at": expires_at, "updated_at": _now_utc()}},
    )
    return {"status": "success", "reset_token": token, "expires_at": expires_at.isoformat()}


@router.get("/auth/unverified-users")
async def get_unverified_users(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    await _require_admin_user(current_user)
    client = get_motor_client()
    users = users_collection(client)
    limit = max(min(limit, 100), 1)

    cursor = users.find({"is_verified": False}).sort("created_at", -1).limit(limit)
    results = []
    async for user in cursor:
        results.append(_safe_user_payload(user))
    return results


@router.get("/auth/user/{user_id}")
async def get_user_by_id(user_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    await _require_admin_user(current_user)
    client = get_motor_client()
    user = await _load_user_by_subject(client, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    payload = _safe_user_payload(user)
    payload["role"] = "admin" if payload["is_admin"] else "alumni"
    payload["profile_id"] = await _find_profile_id(client, str(user["_id"]))
    return payload


@router.post("/auth/verify-user/{user_id}")
async def verify_user(
    user_id: str,
    payload: VerifyUserRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    await _require_admin_user(current_user)
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "is_verified": True,
                "verification_pending": False,
                "verification_notes": payload.notes,
                "verified_at": now,
                "updated_at": now,
            }
        },
    )
    updated = await users.find_one({"_id": user["_id"]})
    return {
        "success": True,
        "message": f"User {updated.get('email')} verified successfully",
        "user": _safe_user_payload(updated),
    }
