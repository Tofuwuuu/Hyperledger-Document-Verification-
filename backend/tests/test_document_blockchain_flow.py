import asyncio
import hashlib
import pathlib
import sys
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from httpx import ASGITransport

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class UpdateResult:
    def __init__(self, matched_count: int):
        self.matched_count = matched_count


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if self._matches(document, query):
                return self._project(document, projection)
        return None

    async def insert_one(self, doc):
        inserted_id = doc.get("_id", ObjectId())
        stored = {**doc, "_id": inserted_id}
        self.documents.append(stored)
        return InsertResult(inserted_id)

    async def update_one(self, query, update):
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get("$set", {}))
                return UpdateResult(1)
        return UpdateResult(0)

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


class FakeDatabase:
    def __init__(self, users, profiles, documents, verification_requests):
        self._collections = {
            "users": users,
            "alumni_profiles": profiles,
            "documents": documents,
            "verification_requests": verification_requests,
        }

    def __getitem__(self, name):
        return self._collections[name]


class FakeClient:
    def __init__(self, db):
        self.db = db

    def get_default_database(self):
        return self.db


class FakeBlockchainManager:
    def __init__(self, *, store_result=None, verify_hash_result=None):
        self.store_calls = []
        self.store_result = store_result or {
            "success": True,
            "transaction_id": "tx-123",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.verify_hash_result = verify_hash_result or {
            "success": True,
            "verified": True,
            "record": {
                "document_id": "doc-1",
                "hash": "abc123",
                "metadata": {"student_id": "2024-0001"},
                "transaction_id": "tx-verify",
            },
        }

    async def store_document(self, document_id, document_hash, metadata):
        self.store_calls.append((document_id, document_hash, metadata))
        return self.store_result

    async def verify_hash(self, document_hash):
        result = dict(self.verify_hash_result)
        record = dict(result.get("record", {}))
        if record:
            result["record"] = record
        return result

    async def verify_document(self, document_id, document_hash):
        return {
            "success": True,
            "verified": True,
            "record": {"document_id": document_id, "hash": document_hash},
        }

    async def get_document_history(self, document_id):
        return {"success": True, "history": [{"document_id": document_id, "tx_id": "tx-1"}]}


def test_upload_document_hashes_file_and_keeps_pending(monkeypatch, tmp_path):
    user_id = ObjectId("69f000000000000000000001")
    profile_id = ObjectId("69f000000000000000000002")
    users = FakeCollection([{"_id": user_id, "full_name": "Ethan Caldwell", "email": "ethan@example.com"}])
    profiles = FakeCollection([{"_id": profile_id, "user_id": user_id, "student_id": "21010882342"}])
    documents = FakeCollection()
    verification_requests = FakeCollection()
    fake_client = FakeClient(FakeDatabase(users, profiles, documents, verification_requests))

    import app.api.endpoints.documents as docs_mod
    import app.utils.auth as auth_mod

    monkeypatch.setattr(docs_mod, "get_motor_client", lambda: fake_client)
    monkeypatch.setattr(docs_mod, "_uploads_dir", lambda: tmp_path)
    app.dependency_overrides[auth_mod.get_current_user] = lambda: {"sub": str(user_id), "is_admin": False}

    file_bytes = b"%PDF-1.7 fake diploma bytes"
    expected_hash = hashlib.sha256(file_bytes).hexdigest()

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/documents/upload",
                data={
                    "alumni_id": str(profile_id),
                    "document_type": "diploma",
                    "title": "Diploma PDF",
                    "description": "Graduation diploma",
                },
                files={"file": ("diploma.pdf", file_bytes, "application/pdf")},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        stored = documents.documents[0]
        assert stored["verification_status"] == "pending"
        assert stored["status"] == "pending"
        assert stored["file_hash"] == expected_hash
        assert "blockchain_tx_id" not in stored

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(auth_mod.get_current_user, None)


def test_admin_approval_stores_hash_on_blockchain_and_updates_document(monkeypatch):
    admin_id = ObjectId("69f000000000000000000010")
    user_id = ObjectId("69f000000000000000000011")
    profile_id = ObjectId("69f000000000000000000012")
    document_id = ObjectId("69f000000000000000000013")
    file_hash = hashlib.sha256(b"diploma content").hexdigest()
    now = datetime.now(timezone.utc)

    users = FakeCollection([{"_id": user_id, "full_name": "Ethan Caldwell", "email": "ethan@example.com"}])
    profiles = FakeCollection(
        [{"_id": profile_id, "user_id": user_id, "student_id": "21010882342", "full_name": "Ethan Caldwell"}]
    )
    documents = FakeCollection(
        [
            {
                "_id": document_id,
                "user_id": user_id,
                "alumni_profile_id": profile_id,
                "document_type": "diploma",
                "title": "Diploma PDF",
                "file_hash": file_hash,
                "verification_status": "pending",
                "uploaded_at": now,
                "created_at": now,
            }
        ]
    )
    verification_requests = FakeCollection()
    fake_client = FakeClient(FakeDatabase(users, profiles, documents, verification_requests))
    fake_blockchain = FakeBlockchainManager(
        store_result={
            "success": True,
            "transaction_id": "tx-approved-123",
            "timestamp": now.isoformat(),
        }
    )

    import app.api.endpoints.admin as admin_mod

    monkeypatch.setattr(admin_mod, "get_motor_client", lambda: fake_client)
    monkeypatch.setattr(admin_mod, "get_blockchain_manager", lambda: fake_blockchain)
    app.dependency_overrides[admin_mod._require_admin] = lambda: {"sub": str(admin_id), "is_admin": True}

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/admin/verifications/{document_id}/approve",
                json={"admin_notes": "Looks authentic"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["transaction_id"] == "tx-approved-123"

        stored = documents.documents[0]
        assert stored["verification_status"] == "verified"
        assert stored["status"] == "approved"
        assert stored["blockchain_tx_id"] == "tx-approved-123"
        assert stored["file_hash"] == file_hash
        assert len(fake_blockchain.store_calls) == 1
        assert len(verification_requests.documents) == 1

    try:
        asyncio.run(run())
    finally:
        app.dependency_overrides.pop(admin_mod._require_admin, None)


def test_public_verify_file_checks_blockchain_without_document_id(monkeypatch):
    fake_blockchain = FakeBlockchainManager(
        verify_hash_result={
            "success": True,
            "verified": True,
            "record": {
                "document_id": "doc-public-1",
                "hash": hashlib.sha256(b"real diploma").hexdigest(),
                "metadata": {
                    "student_id": "21010882342",
                    "document_type": "diploma",
                    "document_title": "Diploma PDF",
                },
                "transaction_id": "tx-public-1",
            },
        }
    )

    import app.api.endpoints.verification as verification_mod

    monkeypatch.setattr(verification_mod, "get_blockchain_manager", lambda: fake_blockchain)

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/verification/blockchain/verify-file",
                files={"file": ("diploma.pdf", b"real diploma", "application/pdf")},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["verified"] is True
        assert payload["status"] == "VERIFIED"
        assert payload["metadata"]["blockchain_record"]["metadata"]["student_id"] == "21010882342"

    asyncio.run(run())
