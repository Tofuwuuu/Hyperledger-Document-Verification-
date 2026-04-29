import asyncio
import pathlib
import sys
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId
from httpx import ASGITransport

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)
        self._skip = 0
        self._limit = None

    def sort(self, field_name, direction):
        reverse = direction == -1
        self.documents.sort(
            key=lambda doc: doc.get(field_name) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=reverse,
        )
        return self

    def skip(self, count):
        self._skip = count
        return self

    def limit(self, count):
        self._limit = count
        return self

    def __aiter__(self):
        sliced = self.documents[self._skip :]
        if self._limit is not None:
            sliced = sliced[: self._limit]
        self._iter_documents = sliced
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self._iter_documents):
            raise StopAsyncIteration
        value = self._iter_documents[self._index]
        self._index += 1
        return value


class FakeRolesCollection:
    def __init__(self):
        self.docs = {}

    async def find_one(self, query):
        if "name" in query:
            for document in self.docs.values():
                if document.get("name") == query["name"]:
                    return document
            return None
        return self.docs.get(str(query.get("_id")))

    def find(self, query):
        documents = []
        for document in self.docs.values():
            if all(document.get(key) == value for key, value in query.items()):
                documents.append(document)
        return FakeCursor(documents)

    async def count_documents(self, query):
        count = 0
        for document in self.docs.values():
            if all(document.get(key) == value for key, value in query.items()):
                count += 1
        return count

    async def insert_one(self, doc):
        class Result:
            inserted_id = ObjectId("507f1f77bcf86cd799439099")

        self.docs[str(Result.inserted_id)] = {**doc, "_id": Result.inserted_id}
        return Result()

    async def update_one(self, query, update):
        document = self.docs.get(str(query.get("_id")))
        if document:
            document.update(update.get("$set", {}))

    async def delete_one(self, query):
        self.docs.pop(str(query.get("_id")), None)


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
    fake_client = FakeClient(FakeDB(fake_col))

    import app.api.endpoints.admin_roles as admin_roles

    monkeypatch.setattr(admin_roles, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin_roles._require_admin] = lambda: {"sub": "admin", "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/admin/roles",
                json={
                    "name": "editor",
                    "description": "Editor role",
                    "permissions": ["edit"],
                    "is_active": True,
                },
            )
            assert response.status_code == 200
            created = response.json()
            assert created["name"] == "editor"
            assert created["is_active"] is True
            role_id = created["id"]

            get_response = await client.get(f"/api/v1/admin/roles/{role_id}")
            assert get_response.status_code == 200
            role = get_response.json()
            assert role["name"] == "editor"
            assert role["id"] == role_id

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin_roles._require_admin, None)


def test_list_roles_returns_real_role_ids_and_active_status(monkeypatch: pytest.MonkeyPatch):
    fake_col = FakeRolesCollection()
    role_id = ObjectId("507f1f77bcf86cd799439011")
    fake_col.docs[str(role_id)] = {
        "_id": role_id,
        "name": "Administrator",
        "description": "Full admin access",
        "permissions": ["manage_roles"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    fake_client = FakeClient(FakeDB(fake_col))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": "admin", "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/admin/roles?page=1&limit=10")

        assert response.status_code == 200
        payload = response.json()
        assert payload["items"][0]["id"] == str(role_id)
        assert payload["items"][0]["_id"] == str(role_id)
        assert payload["items"][0]["is_active"] is True

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)
