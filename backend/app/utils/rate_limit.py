"""Small in-memory sliding-window rate limiter.

Good enough for a single-process demo. With several workers or instances,
each keeps its own counts, so swap this for Redis if the app scales out.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

TOO_MANY_TRIES = "Too many tries. Wait a few minutes and try again."

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)

# (max attempts, window in seconds)
LOGIN_LIMIT = (10, 300)
MFA_VERIFY_LIMIT = (5, 300)
RESET_LIMIT = (5, 900)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_rate_limit(bucket: str, key: str, limit: tuple[int, int]) -> None:
    """Record one attempt for (bucket, key) and raise 429 once the limit is exceeded."""
    max_attempts, window = limit
    now = time.monotonic()
    full_key = f"{bucket}:{key}"
    with _lock:
        hits = _hits[full_key]
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= max_attempts:
            retry_after = max(1, int(window - (now - hits[0])))
            raise HTTPException(
                status_code=429,
                detail=TOO_MANY_TRIES,
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


def reset_rate_limits() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _hits.clear()
