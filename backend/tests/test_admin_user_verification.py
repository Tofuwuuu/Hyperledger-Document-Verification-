import asyncio
import pathlib
import sys
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from httpx import ASGITransport

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, field_name, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda doc: doc.get(field_name) or datetime.min.replace(tzinfo=timezone.utc), reverse=reverse)
        return self

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self.documents):
            raise StopAsyncIteration
        value = self.documents[self._index]
        self._index += 1
        return value


class FakeUsersCollection:
    def __init__(self, documents):
        self.documents = list(documents)

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if self._matches(document, query):
                return self._project(document, projection)
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if self._matches(document, query)])

    async def update_one(self, query, update):
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get("$set", {}))
                return

    @staticmethod
    def _matches(document, query):
        for key, value in query.items():
            if document.get(key) != value:
                return False
        return True

    @staticmethod
    def _project(document, projection):
        if projection is None:
            return document
        projected = {}
        for key, include in projection.items():
            if include and key in document:
                projected[key] = document[key]
        if "_id" in document:
            projected["_id"] = document["_id"]
        return projected


class FakeProfilesCollection:
    def __init__(self, documents):
        self.documents = list(documents)

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return FakeUsersCollection._project(document, projection)
        return None


class FakeDB:
    def __init__(self, users_collection, profiles_collection):
        self._users = users_collection
        self._profiles = profiles_collection

    def __getitem__(self, name: str):
        if name == "users":
            return self._users
        if name == "alumni_profiles":
            return self._profiles
        raise KeyError(name)


class FakeClient:
    def __init__(self, db):
        self.db = db

    def get_default_database(self):
        return self.db


def test_pending_user_verification_list_filters_active_unverified_users(monkeypatch):
    admin_id = ObjectId("69e8443a162525f0ec57f0cb")
    first_user_id = ObjectId("69e8443a162525f0ec57f0cc")
    second_user_id = ObjectId("69e8443a162525f0ec57f0cd")
    third_user_id = ObjectId("69e8443a162525f0ec57f0d2")
    now = datetime.now(timezone.utc)

    fake_users = FakeUsersCollection(
        [
            {
                "_id": first_user_id,
                "full_name": "Pending User",
                "email": "pending@example.com",
                "is_verified": False,
                "is_active": True,
                "created_at": now,
            },
            {
                "_id": second_user_id,
                "full_name": "Inactive User",
                "email": "inactive@example.com",
                "is_verified": False,
                "is_active": False,
                "created_at": now,
            },
            {
                "_id": third_user_id,
                "full_name": "Legacy Pending User",
                "email": "legacy.pending@example.com",
                "is_verified": False,
                "created_at": now,
            },
            {
                "_id": ObjectId("69e8443a162525f0ec57f0ce"),
                "full_name": "Verified User",
                "email": "verified@example.com",
                "is_verified": True,
                "is_active": True,
                "created_at": now,
            },
        ]
    )
    fake_profiles = FakeProfilesCollection(
        [
            {
                "_id": ObjectId("69e8443a162525f0ec57f0cf"),
                "user_id": first_user_id,
                "student_id": "2024-0001",
                "graduation_year": "2024",
            },
            {
                "_id": ObjectId("69e8443a162525f0ec57f0d3"),
                "user_id": third_user_id,
                "student_id": "2023-0042",
                "graduation_year": "2023",
            }
        ]
    )
    fake_client = FakeClient(FakeDB(fake_users, fake_profiles))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/admin/users/pending-verification")

        assert response.status_code == 200
        payload = response.json()
        emails = {item["email"] for item in payload}
        assert emails == {"pending@example.com", "legacy.pending@example.com"}

        payload_by_email = {item["email"]: item for item in payload}
        assert payload_by_email["pending@example.com"]["student_id"] == "2024-0001"
        assert payload_by_email["pending@example.com"]["graduation_year"] == "2024"
        assert payload_by_email["legacy.pending@example.com"]["student_id"] == "2023-0042"
        assert payload_by_email["legacy.pending@example.com"]["graduation_year"] == "2023"

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)


def test_verified_user_verification_list_returns_active_verified_users(monkeypatch):
    admin_id = ObjectId("69e8443a162525f0ec57f0cb")
    verified_user_id = ObjectId("69e8443a162525f0ec57f0d4")
    now = datetime.now(timezone.utc)

    fake_users = FakeUsersCollection(
        [
            {
                "_id": verified_user_id,
                "full_name": "Verified User",
                "email": "verified@example.com",
                "is_verified": True,
                "is_active": True,
                "created_at": now,
            },
            {
                "_id": ObjectId("69e8443a162525f0ec57f0d5"),
                "full_name": "Inactive Verified User",
                "email": "inactive.verified@example.com",
                "is_verified": True,
                "is_active": False,
                "created_at": now,
            },
            {
                "_id": ObjectId("69e8443a162525f0ec57f0d6"),
                "full_name": "Pending User",
                "email": "pending@example.com",
                "is_verified": False,
                "is_active": True,
                "created_at": now,
            },
        ]
    )
    fake_profiles = FakeProfilesCollection([])
    fake_client = FakeClient(FakeDB(fake_users, fake_profiles))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/admin/users/pending-verification?status=verified")

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["email"] == "verified@example.com"
        assert payload[0]["is_verified"] is True

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)


def test_admin_can_verify_pending_user(monkeypatch):
    admin_id = ObjectId("69e8443a162525f0ec57f0cb")
    user_id = ObjectId("69e8443a162525f0ec57f0d0")
    fake_users = FakeUsersCollection(
        [
            {
                "_id": user_id,
                "full_name": "Verify Me",
                "email": "verifyme@example.com",
                "is_verified": False,
                "is_active": True,
            }
        ]
    )
    fake_profiles = FakeProfilesCollection([])
    fake_client = FakeClient(FakeDB(fake_users, fake_profiles))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/admin/users/{user_id}/verify",
                json={"admin_notes": "Looks good"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["user"]["is_verified"] is True

        stored_user = fake_users.documents[0]
        assert stored_user["verified_by"] == str(admin_id)
        assert stored_user["verification_notes"] == "Looks good"

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)


def test_admin_can_reject_pending_user(monkeypatch):
    admin_id = ObjectId("69e8443a162525f0ec57f0cb")
    user_id = ObjectId("69e8443a162525f0ec57f0d1")
    fake_users = FakeUsersCollection(
        [
            {
                "_id": user_id,
                "full_name": "Reject Me",
                "email": "rejectme@example.com",
                "is_verified": False,
                "is_active": True,
            }
        ]
    )
    fake_profiles = FakeProfilesCollection([])
    fake_client = FakeClient(FakeDB(fake_users, fake_profiles))

    import app.api.endpoints.admin as admin

    monkeypatch.setattr(admin, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[admin._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/admin/users/{user_id}/reject",
                json={"admin_notes": "Not enough information"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["user"]["is_active"] is False

        stored_user = fake_users.documents[0]
        assert stored_user["verification_status"] == "rejected"
        assert stored_user["rejected_by"] == str(admin_id)

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin._require_admin, None)
