import asyncio
import pathlib
import sys

import httpx
from bson import ObjectId
from httpx import ASGITransport

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeUsersCollection:
    def __init__(self, doc):
        self.doc = doc

    async def find_one(self, query):
        if query.get("_id") == self.doc["_id"] and query.get("is_admin", self.doc.get("is_admin")) == self.doc.get("is_admin"):
            return self.doc
        if query.get("_id") == self.doc["_id"]:
            return self.doc
        if query.get("email") == self.doc.get("email"):
            return self.doc
        return None

    async def update_one(self, query, update):
        if query.get("_id") == self.doc["_id"]:
            self.doc.update(update.get("$set", {}))


class FakeDB:
    def __init__(self, users_collection):
        self._users = users_collection

    def __getitem__(self, name: str):
        if name != "users":
            raise KeyError(name)
        return self._users


class FakeClient:
    def __init__(self, db):
        self.db = db

    def get_default_database(self):
        return self.db


def test_admin_profile_get_and_update(monkeypatch):
    admin_id = ObjectId("69e8443a162525f0ec57f0cb")
    fake_user = {
        "_id": admin_id,
        "full_name": "Admin User",
        "email": "admin@example.com",
        "is_admin": True,
        "employee_id": "EMP-001",
    }
    fake_users = FakeUsersCollection(fake_user)
    fake_client = FakeClient(FakeDB(fake_users))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            get_resp = await client.get("/api/v1/admin/profile")
            assert get_resp.status_code == 200
            assert get_resp.json()["full_name"] == "Admin User"

            put_resp = await client.put(
                "/api/v1/admin/profile",
                json={
                    "full_name": "Updated Admin",
                    "department": "IT Department",
                    "position": "System Administrator",
                    "phone": "09123456789",
                },
            )
            assert put_resp.status_code == 200
            data = put_resp.json()
            assert data["full_name"] == "Updated Admin"
            assert data["department"] == "IT Department"
            assert data["position"] == "System Administrator"
            assert data["phone"] == "09123456789"

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)
