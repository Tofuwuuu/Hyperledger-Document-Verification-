import asyncio
import pathlib
import sys

import httpx
from httpx import ASGITransport

import pytest

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeRolesCollection:
    def __init__(self):
        self.docs = {}
        self.inserted = None

    async def find_one(self, query):
        if "name" in query:
            for d in self.docs.values():
                if d.get("name") == query["name"]:
                    return d
            return None
        _id = query.get("_id")
        return self.docs.get(str(_id))

    async def insert_one(self, doc):
        class R:
            inserted_id = "507f1f77bcf86cd799439099"

        self.inserted = doc
        self.docs[str(R.inserted_id)] = {**doc, "_id": R.inserted_id}
        return R()

    async def update_one(self, query, update):
        _id = query.get("_id")
        doc = self.docs.get(str(_id))
        if not doc:
            return
        doc.update(update.get("$set", {}))

    async def delete_one(self, query):
        _id = query.get("_id")
        if str(_id) in self.docs:
            del self.docs[str(_id)]


class FakeDB:
    def __init__(self, roles_collection):
        self.roles_collection = roles_collection

    def __getitem__(self, name: str):
        if name != "roles":
            raise KeyError(name)
        return self.roles_collection


class FakeClient:
    def __init__(self, db: FakeDB):
        self.db = db

    def get_default_database(self):
        return self.db


def test_create_role_and_get(monkeypatch: pytest.MonkeyPatch):
    fake_col = FakeRolesCollection()
    fake_db = FakeDB(fake_col)
    fake_client = FakeClient(fake_db)

    import app.api.endpoints.admin_roles as ar

    monkeypatch.setattr(ar, "get_motor_client", lambda: fake_client)
    # admin guard
    monkeypatch.setattr(ar, "_require_admin_user", lambda: {"sub": "admin", "is_admin": True})

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/admin/roles",
                json={"name": "editor", "description": "Editor role", "permissions": ["edit"]},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["name"] == "editor"
            role_id = data["id"]

            get_resp = await client.get(f"/api/v1/admin/roles/{role_id}")
            assert get_resp.status_code == 200
            get_data = get_resp.json()
            assert get_data["name"] == "editor"

        asyncio.run(run())
