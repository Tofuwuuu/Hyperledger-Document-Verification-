"""RFC 6238 TOTP (30-second steps, 6 digits, SHA-1), compatible with authenticator apps."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret: str) -> bytes:
    padded = secret.upper() + "=" * (-len(secret) % 8)
    return base64.b32decode(padded)


def code_at(secret: str, for_time: float | None = None) -> str:
    counter = int((time.time() if for_time is None else for_time) // STEP_SECONDS)
    digest = hmac.new(_key(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % (10 ** DIGITS):0{DIGITS}d}"


def verify(secret: str, code: str, *, window: int = 1, for_time: float | None = None) -> bool:
    """Accept the current step and +/- `window` steps to allow for clock drift."""
    if not secret or not code:
        return False
    cleaned = "".join(ch for ch in str(code) if ch.isdigit())
    if len(cleaned) != DIGITS:
        return False
    now = time.time() if for_time is None else for_time
    ok = False
    for drift in range(-window, window + 1):
        if hmac.compare_digest(code_at(secret, now + drift * STEP_SECONDS), cleaned):
            ok = True
    return ok


def provisioning_uri(secret: str, account: str, issuer: str = "CVSU Alumni") -> str:
    label = quote(f"{issuer}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}&period={STEP_SECONDS}"
