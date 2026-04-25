import asyncio
import pathlib
import sys

import httpx
from httpx import ASGITransport

import pytest

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeUsersCollection:
    def __init__(self, doc):
        self.doc = doc
        self.updated = None

    async def find_one(self, query):
        return self.doc

    async def update_one(self, query, update):
        self.updated = update


class FakeDB:
    def __init__(self, users_collection):
        self.users_collection = users_collection

    def __getitem__(self, name: str):
        if name != "users":
            raise KeyError(name)
        return self.users_collection


class FakeClient:
    def __init__(self, db: FakeDB):
        self.db = db

    def get_default_database(self):
        return self.db


def test_change_password_success(monkeypatch: pytest.MonkeyPatch):
    # Create a fake user with bcrypt password
    import bcrypt

    pw = bcrypt.hashpw(b"oldpass", bcrypt.gensalt()).decode("utf-8")
    fake_doc = {"_id": "507f1f77bcf86cd799439011", "password_hash": pw}
    fake_col = FakeUsersCollection(fake_doc)
    fake_db = FakeDB(fake_col)
    fake_client = FakeClient(fake_db)

    # monkeypatch motor client getter
    import app.api.endpoints.auth_password as ap

    monkeypatch.setattr(ap, "get_motor_client", lambda: fake_client)

    # Use FastAPI dependency override so Depends() resolves properly
    app.dependency_overrides[ap.get_current_user] = lambda: {"sub": "507f1f77bcf86cd799439011"}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/change-password",
                json={"current_password": "oldpass", "new_password": "newpass123", "confirm_password": "newpass123"},
            )
            assert resp.status_code == 200
            data = resp.json()
            # Temporary debug output
            print("change-password response:", data)
            assert data.get("success") is True

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(ap.get_current_user, None)
