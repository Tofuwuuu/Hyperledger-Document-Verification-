import asyncio
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import httpx
from bson import ObjectId
from httpx import ASGITransport

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeUsersCollection:
    def __init__(self, documents):
        self.documents = list(documents)

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if self._matches(document, query):
                return document
        return None

    async def update_one(self, query, update):
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get("$set", {}))
                for key in update.get("$unset", {}):
                    document.pop(key, None)

                class Result:
                    matched_count = 1

                return Result()

        class Result:
            matched_count = 0

        return Result()

    @staticmethod
    def _matches(document, query):
        for key, value in query.items():
            if document.get(key) != value:
                return False
        return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)
        self._skip = 0
        self._limit = None

    def sort(self, field_name, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda doc: doc.get(field_name), reverse=reverse)
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


class FakeNotificationsCollection:
    def __init__(self, documents):
        self.documents = list(documents)

    async def find_one(self, query):
        for document in self.documents:
            if self._matches(document, query):
                return document
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if self._matches(document, query)])

    async def count_documents(self, query):
        return len([document for document in self.documents if self._matches(document, query)])

    async def insert_one(self, doc):
        inserted_id = ObjectId("507f1f77bcf86cd799439088")
        self.documents.append({**doc, "_id": inserted_id})

        class Result:
            pass

        result = Result()
        result.inserted_id = inserted_id
        return result

    async def update_many(self, query, update):
        matched = 0
        for document in self.documents:
            if self._matches(document, query):
                matched += 1
                document.update(update.get("$set", {}))

        class Result:
            matched_count = matched

        return Result()

    async def update_one(self, query, update):
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get("$set", {}))

                class Result:
                    matched_count = 1

                return Result()

        class Result:
            matched_count = 0

        return Result()

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if self._matches(document, query):
                self.documents.pop(index)

                class Result:
                    deleted_count = 1

                return Result()

        class Result:
            deleted_count = 0

        return Result()

    @staticmethod
    def _matches(document, query):
        for key, value in query.items():
            if isinstance(value, dict):
                if "$in" in value:
                    if document.get(key) not in value["$in"]:
                        return False
                elif "$gt" in value:
                    if not document.get(key) or document.get(key) <= value["$gt"]:
                        return False
                else:
                    return False
            elif document.get(key) != value:
                return False
        return True


class FakeDB:
    def __init__(self, users_collection=None, notifications_collection=None):
        self._users = users_collection
        self._notifications = notifications_collection

    def __getitem__(self, name: str):
        if name == "users":
            return self._users
        if name == "notifications":
            return self._notifications
        raise KeyError(name)


class FakeClient:
    def __init__(self, db):
        self.db = db

    def get_default_database(self):
        return self.db


def test_mfa_setup_enable_disable_flow(monkeypatch):
    user_id = ObjectId("69e8443a162525f0ec57f0cb")
    fake_user = {
        "_id": user_id,
        "email": "mfa@example.com",
        "full_name": "MFA User",
        "mfa_enabled": False,
    }
    fake_users = FakeUsersCollection([fake_user])
    fake_client = FakeClient(FakeDB(users_collection=fake_users))

    import app.api.register as register_module

    monkeypatch.setattr(register_module, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[register_module.get_current_user] = lambda: {"sub": str(user_id), "is_admin": False}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            setup_response = await client.post("/api/v1/auth/mfa/setup", json={"type": "email"})
            assert setup_response.status_code == 200
            setup_payload = setup_response.json()
            assert setup_payload["is_enabled"] is False
            assert setup_payload["has_pending_setup"] is True
            assert len(setup_payload["verification_code"]) == 6

            status_response = await client.get("/api/v1/auth/mfa/status")
            assert status_response.status_code == 200
            assert status_response.json()["has_pending_setup"] is True

            enable_response = await client.post(
                "/api/v1/auth/mfa/enable",
                json={"verification_code": setup_payload["verification_code"]},
            )
            assert enable_response.status_code == 200
            assert enable_response.json()["is_enabled"] is True

            disable_response = await client.post("/api/v1/auth/mfa/disable")
            assert disable_response.status_code == 200
            assert disable_response.json()["is_enabled"] is False

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(register_module.get_current_user, None)


def test_notifications_contract_matches_frontend(monkeypatch):
    user_id = ObjectId("69e8443a162525f0ec57f0cb")
    other_user_id = ObjectId("69e8443a162525f0ec57f0cc")
    older_id = ObjectId("69e8443a162525f0ec57f0d0")
    middle_id = ObjectId("69e8443a162525f0ec57f0d1")
    newer_id = ObjectId("69e8443a162525f0ec57f0d2")
    now = datetime.now(timezone.utc)

    fake_notifications = FakeNotificationsCollection(
        [
            {
                "_id": older_id,
                "user_id": str(user_id),
                "title": "Old unread",
                "body": "Old unread body",
                "type": "document",
                "metadata": {"document_id": "doc-1"},
                "read": False,
                "created_at": now - timedelta(minutes=5),
            },
            {
                "_id": middle_id,
                "user_id": str(user_id),
                "title": "Middle read",
                "body": "Middle read body",
                "type": "system",
                "metadata": {},
                "read": True,
                "created_at": now - timedelta(minutes=3),
            },
            {
                "_id": newer_id,
                "user_id": str(user_id),
                "title": "Newest unread",
                "body": "Newest unread body",
                "type": "event",
                "metadata": {},
                "read": False,
                "created_at": now - timedelta(minutes=1),
            },
            {
                "_id": ObjectId("69e8443a162525f0ec57f0d3"),
                "user_id": str(other_user_id),
                "title": "Other user",
                "body": "Other user body",
                "type": "system",
                "metadata": {},
                "read": False,
                "created_at": now,
            },
        ]
    )
    fake_client = FakeClient(FakeDB(notifications_collection=fake_notifications))

    import app.api.endpoints.notifications as notifications_module

    monkeypatch.setattr(notifications_module, "get_motor_client", lambda: fake_client)
    app.dependency_overrides[notifications_module.get_current_user] = lambda: {"sub": str(user_id), "is_admin": False}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/notifications?include_read=true&limit=10")
            assert response.status_code == 200
            payload = response.json()
            assert "notifications" in payload
            assert payload["unread_count"] == 2
            assert payload["count"] == 3
            assert payload["notifications"][0]["message"] == "Newest unread body"
            assert payload["notifications"][0]["timestamp"] is not None

            unread_response = await client.get("/api/v1/notifications?include_read=false&limit=10")
            assert unread_response.status_code == 200
            unread_payload = unread_response.json()
            assert unread_payload["count"] == 2
            assert all(not item["is_read"] for item in unread_payload["notifications"])

            since_response = await client.get(f"/api/v1/notifications?include_read=true&since_id={middle_id}")
            assert since_response.status_code == 200
            since_payload = since_response.json()
            assert since_payload["count"] == 1
            assert since_payload["notifications"][0]["_id"] == str(newer_id)

            mark_read_response = await client.post(f"/api/v1/notifications/{newer_id}/read")
            assert mark_read_response.status_code == 200

            delete_response = await client.delete(f"/api/v1/notifications/{middle_id}")
            assert delete_response.status_code == 200

            read_all_response = await client.post("/api/v1/notifications/read-all")
            assert read_all_response.status_code == 200

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(notifications_module.get_current_user, None)
