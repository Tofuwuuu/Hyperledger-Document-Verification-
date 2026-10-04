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


def current_step(for_time: float | None = None) -> int:
    return int((time.time() if for_time is None else for_time) // STEP_SECONDS)


def matching_step(
    secret: str,
    code: str,
    *,
    window: int = 1,
    for_time: float | None = None,
    after_step: int | None = None,
) -> int | None:
    """Return the time step the code belongs to, or None.

    Accepts the current step and +/- `window` steps for clock drift. Steps at or
    before `after_step` are refused, so an accepted code can't be used twice.
    """
    if not secret or not code:
        return None
    cleaned = "".join(ch for ch in str(code) if ch.isdigit())
    if len(cleaned) != DIGITS:
        return None
    now = time.time() if for_time is None else for_time
    matched: int | None = None
    for drift in range(-window, window + 1):
        at = now + drift * STEP_SECONDS
        if hmac.compare_digest(code_at(secret, at), cleaned):
            step = current_step(at)
            if after_step is None or step > after_step:
                matched = step
    return matched


def verify(secret: str, code: str, *, window: int = 1, for_time: float | None = None) -> bool:
    """Accept the current step and +/- `window` steps to allow for clock drift."""
    return matching_step(secret, code, window=window, for_time=for_time) is not None


def provisioning_uri(secret: str, account: str, issuer: str = "CVSU Alumni") -> str:
    label = quote(f"{issuer}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}&period={STEP_SECONDS}"
