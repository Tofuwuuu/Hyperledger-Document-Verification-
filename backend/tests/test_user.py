import pathlib
import sys

import asyncio

import httpx
from httpx import ASGITransport


# Ensure `backend/` is on sys.path so `from app.main import app` works when running
# tests from the repo root.
backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


def test_health_endpoint() -> None:
    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/healthcheck/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}

    asyncio.run(run())

