import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.config import settings
from app.db.collections import alumni_profiles_collection, users_collection
from app.db.session import get_motor_client
from app.utils import totp
from app.utils.auth import (
    TOKEN_TYPE_CSRF,
    TOKEN_TYPE_MFA_PENDING,
    create_access_token,
    create_mfa_pending_token,
    create_token,
    get_current_user,
    load_user_for_token,
)
from app.utils.rate_limit import (
    LOGIN_LIMIT,
    MFA_VERIFY_LIMIT,
    RESET_LIMIT,
    check_rate_limit,
    client_ip,
)
from app.utils.mongo_ids import find_one_by_id

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
    type: str = "totp"


class MFAEnableRequest(BaseModel):
    verification_code: str = Field(min_length=4, max_length=12)


class MFAVerifyRequest(BaseModel):
    mfa_token: str = Field(min_length=10, max_length=4096)
    code: str = Field(min_length=6, max_length=12)
    remember: bool = False


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
    return await find_one_by_id(users_collection(client), subject)


async def _require_admin_user(current_user: dict) -> dict:
    # `current_user` comes from get_current_user, which reads is_admin from the database.
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


def _mfa_status_payload(user: dict) -> dict:
    expires_at = user.get("mfa_setup_expires_at")
    has_pending_setup = bool(user.get("mfa_pending_secret")) and not _is_token_expired(expires_at)
    return {
        "success": True,
        "is_enabled": bool(user.get("mfa_enabled", False)),
        "mfa_type": "totp",
        "email": user.get("email"),
        "has_pending_setup": has_pending_setup,
        "expires_at": expires_at.isoformat() if isinstance(expires_at, datetime) else None,
    }



GENERIC_LOGIN_ERROR = "Incorrect email or password."
RESET_DISABLED_DETAIL = "Password reset isn't available in the demo."
RESET_REQUESTED_MESSAGE = "If an account exists for that email, reset instructions have been sent."
RESET_TOKEN_MINUTES = 30
# Compared against when the email is unknown, so both paths cost one bcrypt check.
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode("utf-8")


def _reset_disabled_response() -> JSONResponse:
    # Same response for every caller and every email: no lookup happens at all.
    return JSONResponse(status_code=503, content={"detail": RESET_DISABLED_DETAIL})


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _issue_reset_token(users, user: dict) -> str:
    """Random one-time token. Only its hash is stored. It is not a JWT and can't authenticate."""
    token = secrets.token_urlsafe(32)
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_token_hash": _hash_reset_token(token),
                "password_reset_expires_at": _now_utc() + timedelta(minutes=RESET_TOKEN_MINUTES),
                "updated_at": _now_utc(),
            }
        },
    )
    return token


async def _user_for_reset_token(users, token: str) -> dict:
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    user = await users.find_one({"password_reset_token_hash": _hash_reset_token(token)})
    if not user or _is_token_expired(user.get("password_reset_expires_at")):
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")
    return user


def _login_success_payload(user: dict) -> dict:
    return {
        "success": True,
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": _safe_user_payload(user),
    }


@router.post("/auth/register")
async def register_user(payload: RegisterRequest) -> dict:
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
            "token_version": 0,
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
        logger.exception("MongoDB error during registration: %s", exc.__class__.__name__)
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Ensure MongoDB is running and MONGODB_URL is correct.",
        )

    return {"success": True, "user": _safe_user_payload(merged)}


@router.post("/auth/login")
async def login_user(payload: LoginRequest, request: Request) -> dict:
    normalized = _normalize_email(str(payload.email))
    check_rate_limit("login", f"{client_ip(request)}|{normalized}", LOGIN_LIMIT)

    client = get_motor_client()
    users = users_collection(client)
    try:
        user = await users.find_one({"email": normalized})
    except PyMongoError:
        logger.exception("MongoDB error during login")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Ensure MongoDB is running and MONGODB_URL is correct.",
        )

    password_hash = _canonical_password_hash(user) if user else None
    # Always run one bcrypt check so unknown emails take as long as wrong passwords.
    matched = _password_matches(payload.password, password_hash or _DUMMY_PASSWORD_HASH)
    if not user or not password_hash or not matched:
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)
    if user.get("is_active") is False:
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    if user.get("mfa_enabled") and user.get("mfa_secret"):
        # Password step only. The pending token works for /auth/mfa/verify and nothing else.
        return {
            "success": True,
            "mfa_required": True,
            "mfa_token": create_mfa_pending_token(user),
            "token_type": TOKEN_TYPE_MFA_PENDING,
            "expires_in": 300,
        }

    now = datetime.now(timezone.utc)
    await users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now, "updated_at": now}})
    return _login_success_payload(user)


@router.post("/auth/mfa/verify")
async def verify_mfa_login(payload: MFAVerifyRequest, request: Request) -> dict:
    check_rate_limit("mfa", client_ip(request), MFA_VERIFY_LIMIT)
    _claims, user = await load_user_for_token(payload.mfa_token, TOKEN_TYPE_MFA_PENDING)
    check_rate_limit("mfa-user", str(user["_id"]), MFA_VERIFY_LIMIT)
    secret = user.get("mfa_secret")
    if not user.get("mfa_enabled") or not secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled for this account")
    if not totp.verify(secret, payload.code):
        raise HTTPException(status_code=401, detail="That code didn't work. Check your app and try again.")

    now = datetime.now(timezone.utc)
    await users_collection(get_motor_client()).update_one(
        {"_id": user["_id"]}, {"$set": {"last_login_at": now, "updated_at": now}}
    )
    return _login_success_payload(user)


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

    # Only a still-valid, unrevoked access token can be exchanged.
    _claims, user = await load_user_for_token(payload.refresh_token)
    new_token = create_access_token(user)
    return {
        "access_token": new_token,
        "refresh_token": new_token,
        "token_type": "bearer",
    }


@router.post("/auth/logout")
async def logout_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Bump the user's token version, which ends every token issued before now."""
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if user:
        next_version = int(user.get("token_version", 0) or 0) + 1
        await users.update_one({"_id": user["_id"]}, {"$set": {"token_version": next_version, "updated_at": _now_utc()}})
    return {"success": True}


@router.get("/auth/csrf-token")
async def get_csrf_token() -> dict:
    token = create_token({"_id": "csrf"}, token_type=TOKEN_TYPE_CSRF, expires_minutes=60)
    return {"csrf_token": token}


@router.post("/auth/reset-password")
async def request_password_reset(payload: ResetPasswordRequest, request: Request):
    check_rate_limit("reset", client_ip(request), RESET_LIMIT)
    if not settings.password_reset_enabled:
        return _reset_disabled_response()

    users = users_collection(get_motor_client())
    user = await users.find_one({"email": _normalize_email(str(payload.email))})
    if user:
        # The token is never returned here. Deliver it by email once email sending exists.
        await _issue_reset_token(users, user)
    return {"success": True, "message": RESET_REQUESTED_MESSAGE}


@router.post("/auth/verify-reset-token")
async def verify_reset_token(payload: VerifyResetTokenRequest, request: Request):
    check_rate_limit("reset", client_ip(request), RESET_LIMIT)
    if not settings.password_reset_enabled:
        return _reset_disabled_response()
    user = await _user_for_reset_token(users_collection(get_motor_client()), payload.token)
    return {"success": True, "valid": True, "email": user.get("email")}


@router.post("/auth/reset-password-confirm")
async def reset_password_confirm(payload: ResetPasswordConfirmRequest, request: Request):
    check_rate_limit("reset", client_ip(request), RESET_LIMIT)
    if not settings.password_reset_enabled:
        return _reset_disabled_response()
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    users = users_collection(get_motor_client())
    user = await _user_for_reset_token(users, payload.token)
    new_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "password_reset_token_hash": None,
                "password_reset_expires_at": None,
                # A new password ends every existing session.
                "token_version": int(user.get("token_version", 0) or 0) + 1,
                "updated_at": _now_utc(),
            },
        },
    )
    return {"success": True, "message": "Password has been reset successfully"}


@router.get("/auth/mfa/status")
async def get_mfa_status(current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _mfa_status_payload(user)


@router.post("/auth/mfa/setup")
async def setup_mfa(payload: MFASetupRequest, current_user: dict = Depends(get_current_user)) -> dict:
    """Start TOTP setup. Returns the secret for the authenticator app, never a current code."""
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("mfa_enabled"):
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    secret = totp.generate_secret()
    expires_at = _now_utc() + timedelta(minutes=10)
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "mfa_pending_secret": secret,
                "mfa_setup_expires_at": expires_at,
                "updated_at": _now_utc(),
            }
        },
    )

    updated = await users.find_one({"_id": user["_id"]})
    response = _mfa_status_payload(updated or user)
    response.update(
        {
            "message": "Add this account to your authenticator app, then enter the 6-digit code.",
            "secret": secret,
            "otpauth_url": totp.provisioning_uri(secret, str(user.get("email") or "")),
        }
    )
    return response


@router.post("/auth/mfa/enable")
async def enable_mfa(payload: MFAEnableRequest, current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    pending = user.get("mfa_pending_secret")
    if not pending or _is_token_expired(user.get("mfa_setup_expires_at")):
        raise HTTPException(status_code=400, detail="MFA setup expired. Start again.")
    if not totp.verify(pending, payload.verification_code):
        raise HTTPException(status_code=400, detail="That code didn't work. Check your app and try again.")

    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "mfa_enabled": True,
                "mfa_type": "totp",
                "mfa_secret": pending,
                "mfa_pending_secret": None,
                "mfa_setup_expires_at": None,
                "updated_at": _now_utc(),
            },
        },
    )

    updated = await users.find_one({"_id": user["_id"]})
    response = _mfa_status_payload(updated or user)
    response["message"] = "MFA enabled"
    return response


@router.post("/auth/mfa/disable")
async def disable_mfa(current_user: dict = Depends(get_current_user)) -> dict:
    client = get_motor_client()
    users = users_collection(client)
    user = await _load_user_by_subject(client, str(current_user.get("sub", "")))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_pending_secret": None,
                "mfa_setup_expires_at": None,
                "updated_at": _now_utc(),
            },
        },
    )
    updated = await users.find_one({"_id": user["_id"]})
    response = _mfa_status_payload(updated or user)
    response["message"] = "MFA disabled"
    return response


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
async def get_security_questions(email: str, request: Request):
    # Part of account recovery, so it follows the password reset switch.
    check_rate_limit("reset", client_ip(request), RESET_LIMIT)
    if not settings.password_reset_enabled:
        return _reset_disabled_response()
    normalized = _normalize_email(email)
    user = await users_collection(get_motor_client()).find_one({"email": normalized}, {"security_questions": 1})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    questions = user.get("security_questions") or []
    if len(questions) < 2:
        raise HTTPException(status_code=400, detail="Security questions are not configured for this account")
    return {"questions": [{"index": idx, "question": item.get("question")} for idx, item in enumerate(questions)]}


@router.post("/auth/verify-security-questions")
async def verify_security_questions(payload: VerifySecurityQuestionsRequest, request: Request):
    check_rate_limit("reset", client_ip(request), RESET_LIMIT)
    if not settings.password_reset_enabled:
        return _reset_disabled_response()
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

    # A one-time reset token (not a JWT), usable only with /auth/reset-password-confirm.
    token = await _issue_reset_token(users, user)
    return {"status": "success", "reset_token": token, "expires_in": RESET_TOKEN_MINUTES * 60}


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
