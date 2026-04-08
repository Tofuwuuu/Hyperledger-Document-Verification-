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
    def __init__(self, existing_email=None, existing_student_id=None) -> None:
        self.existing_email = existing_email
        self.existing_student_id = existing_student_id
        self.inserted_doc = None

    async def find_one(self, query):
        if "email" in query:
            return self.existing_email
        if "student_id" in query:
            return self.existing_student_id
        return None

    async def insert_one(self, doc):
        self.inserted_doc = doc
        return {"inserted_id": "fake-id"}


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


def test_register_password_mismatch() -> None:
    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "test1@example.com",
                    "full_name": "Test User",
                    "student_id": "2026-0001",
                    "graduation_year": 2026,
                    "password": "secret123",
                    "confirm_password": "different123",
                },
            )
            assert resp.status_code == 400
            assert resp.json()["detail"] == "Passwords do not match"

    asyncio.run(run())


def test_register_success_inserts_hashed_password(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_collection = FakeCollection(existing_email=None, existing_student_id=None)
    fake_db = FakeDB(fake_collection)
    fake_client = FakeClient(fake_db)

    monkeypatch.setattr(register_module, "get_motor_client", lambda: fake_client)

    async def run() -> None:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "test2@example.com",
                    "full_name": "Test User 2",
                    "student_id": "2026-0002",
                    "graduation_year": 2026,
                    "password": "secret123",
                    "confirm_password": "secret123",
                },
            )

            assert resp.status_code == 200
            assert resp.json() == {"success": True}

    asyncio.run(run())

    assert fake_collection.inserted_doc is not None
    inserted = fake_collection.inserted_doc

    assert inserted["email"] == "test2@example.com"
    assert inserted["student_id"] == "2026-0002"
    assert inserted["password_hash"] != "secret123"
    # bcrypt hashes start with $2a/$2b/$2y...
    assert inserted["password_hash"].startswith("$2")

