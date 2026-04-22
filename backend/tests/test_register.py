import asyncio
import pathlib
import sys

import httpx
from httpx import ASGITransport

import pytest


backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402
import app.api.register as register_module  # noqa: E402


class FakeCollection:
    def __init__(self, existing_normalized_email=None) -> None:
        self.existing_normalized_email = existing_normalized_email
        self.inserted_doc = None

    async def find_one(self, query):
        email = query.get("email")
        if email is not None and email == self.existing_normalized_email:
            return {"_id": "dup-id", "email": email}
        return None

    async def insert_one(self, doc):
        self.inserted_doc = doc

        class R:
            inserted_id = "507f1f77bcf86cd799439011"

        return R()


class FakeDB:
    def __init__(self, users_collection: FakeCollection) -> None:
        self.users_collection = users_collection

    def __getitem__(self, name: str):
        if name != "users":
            raise KeyError(name)
        return self.users_collection


class FakeClient:
    def __init__(self, db: FakeDB) -> None:
        self.db = db

    def get_default_database(self):
        return self.db


class FakeCollectionLogin:
    """Returns a user row whose password_hash is not bcrypt (would crash checkpw)."""

    async def find_one(self, query):
        return {
            "_id": "507f1f77bcf86cd799439011",
            "email": "legacy@example.com",
            "password_hash": "not-a-bcrypt-string",
            "is_admin": False,
            "is_verified": False,
        }


class FakeDBLogin:
    def __getitem__(self, name: str):
        if name != "users":
            raise KeyError(name)
        return FakeCollectionLogin()


class FakeClientLogin:
    def get_default_database(self):
        return FakeDBLogin()


def test_register_password_mismatch() -> None:
    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Test User One",
                    "email": "test1@example.com",
                    "password": "secret123",
                    "confirm_password": "different123",
                },
            )
            assert resp.status_code == 400
            assert resp.json()["detail"] == "Passwords do not match"

    asyncio.run(run())


def test_register_success_inserts_hashed_password(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_collection = FakeCollection(existing_normalized_email=None)
    fake_db = FakeDB(fake_collection)
    fake_client = FakeClient(fake_db)

    monkeypatch.setattr(register_module, "get_motor_client", lambda: fake_client)

    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Test User Two",
                    "email": "Test2@Example.com",
                    "password": "secret123",
                    "confirm_password": "secret123",
                },
            )

            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["user"]["email"] == "test2@example.com"
            assert data["user"]["id"] == "507f1f77bcf86cd799439011"

    asyncio.run(run())

    assert fake_collection.inserted_doc is not None
    inserted = fake_collection.inserted_doc

    assert inserted["email"] == "test2@example.com"
    assert inserted["password_hash"] != "secret123"
    assert inserted["password_hash"].startswith("$2")
    assert "created_at" in inserted


def test_login_invalid_stored_hash_returns_401_not_500(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(register_module, "get_motor_client", lambda: FakeClientLogin())

    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "legacy@example.com",
                    "password": "any-password",
                },
            )
            assert resp.status_code == 401
            assert resp.json()["detail"] == "Incorrect password."

    asyncio.run(run())
