from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db.collections import users_collection
from app.db.session import get_motor_client
from app.utils.mongo_ids import find_one_by_id

security = HTTPBearer(auto_error=False)

# Token types. Only "access" tokens are accepted by protected routes.
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_MFA_PENDING = "mfa_pending"
TOKEN_TYPE_CSRF = "csrf"


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(message: bytes) -> str:
    secret = settings.secret_key.encode("utf-8")
    return _b64url_encode(hmac.new(secret, message, hashlib.sha256).digest())


def _unauthorized(detail: str = "Invalid authentication credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _encode(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _sign(f"{header_part}.{payload_part}".encode("utf-8"))
    return f"{header_part}.{payload_part}.{signature}"


def create_token(
    user: dict[str, Any],
    *,
    token_type: str,
    expires_minutes: int,
    auth_time: int | None = None,
    not_after: int | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    exp = int((now + timedelta(minutes=expires_minutes)).timestamp())
    if not_after is not None:
        exp = min(exp, int(not_after))
    payload = {
        "sub": str(user.get("_id", "")),
        "email": user.get("email"),
        # Informational only, for the UI. The server re-reads both from the database.
        "is_admin": bool(user.get("is_admin", False)),
        "is_verified": bool(user.get("is_verified", False)),
        "type": token_type,
        "ver": int(user.get("token_version", 0) or 0),
        "iat": int(now.timestamp()),
        # When the user actually signed in. Refreshes carry it forward unchanged.
        "auth_time": int(auth_time if auth_time is not None else now.timestamp()),
        "exp": exp,
    }
    return _encode(payload)


def session_deadline(auth_time: int) -> int:
    return int(auth_time) + settings.session_max_hours * 3600


def create_access_token(
    user: dict[str, Any],
    expires_minutes: int | None = None,
    *,
    auth_time: int | None = None,
) -> str:
    """Access token. With `auth_time` (a refresh), expiry never passes the session cap."""
    return create_token(
        user,
        token_type=TOKEN_TYPE_ACCESS,
        expires_minutes=expires_minutes or settings.access_token_minutes,
        auth_time=auth_time,
        not_after=session_deadline(auth_time) if auth_time is not None else None,
    )


def create_mfa_pending_token(user: dict[str, Any]) -> str:
    return create_token(
        user,
        token_type=TOKEN_TYPE_MFA_PENDING,
        expires_minutes=settings.mfa_pending_token_minutes,
    )


def decode_access_token(token: str, expected_type: str = TOKEN_TYPE_ACCESS) -> dict[str, Any]:
    """Verify signature, expiry, and token type. Raises 401 on any mismatch."""
    try:
        header_part, payload_part, signature = token.split(".")
    except (ValueError, AttributeError) as exc:
        raise _unauthorized() from exc

    expected_signature = _sign(f"{header_part}.{payload_part}".encode("utf-8"))
    if not hmac.compare_digest(signature, expected_signature):
        raise _unauthorized()

    try:
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except Exception as exc:
        raise _unauthorized() from exc
    if not isinstance(payload, dict):
        raise _unauthorized()

    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise _unauthorized("Token expired")
    if payload.get("type") != expected_type:
        raise _unauthorized()
    return payload


def _auth_client():
    return get_motor_client()


async def load_user_for_token(token: str, expected_type: str = TOKEN_TYPE_ACCESS) -> tuple[dict[str, Any], dict[str, Any]]:
    """Decode a token and load its user. Rejects inactive users and revoked tokens."""
    claims = decode_access_token(token, expected_type)
    subject = str(claims.get("sub") or "")
    if not subject:
        raise _unauthorized()
    user = await find_one_by_id(users_collection(_auth_client()), subject)
    if not user:
        raise _unauthorized("User not found")
    if user.get("is_active") is False:
        raise _unauthorized("Account is disabled")
    if int(claims.get("ver", 0) or 0) != int(user.get("token_version", 0) or 0):
        raise _unauthorized("Session has ended. Sign in again.")
    return claims, user


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict[str, Any]:
    """Authenticated caller. Admin and verified flags come from the database, never the token."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Not authenticated")
    claims, user = await load_user_for_token(credentials.credentials, TOKEN_TYPE_ACCESS)
    return {
        **claims,
        "sub": str(user["_id"]),
        "email": user.get("email"),
        "is_admin": bool(user.get("is_admin", False)),
        "is_verified": bool(user.get("is_verified", False)),
    }


async def get_current_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_current_verified_user(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Caller whose account an admin has verified (admins always pass)."""
    if not (current_user.get("is_admin") or current_user.get("is_verified")):
        raise HTTPException(status_code=403, detail="Your account must be verified by an admin first.")
    return current_user
