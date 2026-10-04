"""Small in-memory sliding-window rate limiter.

Good enough for a single-process demo. With several workers or instances,
each keeps its own counts, so swap this for Redis if the app scales out.
"""

from __future__ import annotations

import ipaddress
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

TOO_MANY_TRIES = "Too many tries. Wait a few minutes and try again."

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)

# (max attempts, window in seconds)
LOGIN_LIMIT = (10, 300)
MFA_VERIFY_LIMIT = (5, 300)
RESET_LIMIT = (5, 900)


def _parse_ip(value: str):
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def _trusted_networks() -> list:
    networks = []
    for item in settings.trusted_proxies_list:
        try:
            networks.append(ipaddress.ip_network(item, strict=False))
        except ValueError:
            continue
    return networks


def _is_trusted(ip, networks: list) -> bool:
    return ip is not None and any(ip in network for network in networks)


def client_ip(request: Request) -> str:
    """The address to rate-limit on.

    X-Forwarded-For is only read when the direct peer is a proxy listed in
    TRUSTED_PROXIES. Anyone else could put any address in that header. The
    header is walked from the right, skipping trusted proxies, and the first
    address that isn't one of them is the client.
    """
    peer = request.client.host if request.client else "unknown"
    networks = _trusted_networks()
    if not networks or not _is_trusted(_parse_ip(peer), networks):
        return peer
    forwarded = request.headers.get("x-forwarded-for", "")
    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    for hop in reversed(hops):
        ip = _parse_ip(hop)
        if ip is None:
            break
        if not _is_trusted(ip, networks):
            return str(ip)
    return peer


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
