from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi.testclient import TestClient

from app.api import register as register_api
from app.api.endpoints import admin as admin_api
from app.api.endpoints import alumni as alumni_api
from app.api.endpoints import document_requests as document_requests_api
from app.api.endpoints import documents as documents_api
from app.api.endpoints import verification as verification_api
from app.main import app
from app.utils.auth import create_access_token


class InsertResult:
    def __init__(self, inserted_id: ObjectId):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count: int, upserted_id: ObjectId | None = None):
        self.matched_count = matched_count
        self.upserted_id = upserted_id


class AsyncCursor:
    def __init__(self, items: list[dict[str, Any]]):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    def limit(self, count: int):
        self.items = self.items[:count]
        return self

    def skip(self, count: int):
        self.items = self.items[count:]
        return self

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self._index]
        self._index += 1
        return deepcopy(item)


class AsyncCollection:
    def __init__(self):
        self.docs: list[dict[str, Any]] = []

    async def insert_one(self, doc: dict[str, Any]) -> InsertResult:
        stored = deepcopy(doc)
        stored.setdefault("_id", ObjectId())
        self.docs.append(stored)
        return InsertResult(stored["_id"])

    async def find_one(self, query: dict[str, Any] | None = None, *_args, **_kwargs):
        for doc in self.docs:
            if _matches(doc, query or {}):
                return deepcopy(doc)
        return None

    def find(self, query: dict[str, Any] | None = None, *_args, **_kwargs):
        return AsyncCursor([deepcopy(doc) for doc in self.docs if _matches(doc, query or {})])

    async def update_one(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> UpdateResult:
        for doc in self.docs:
            if _matches(doc, query):
                if "$set" in update:
                    doc.update(deepcopy(update["$set"]))
                return UpdateResult(1)

        if upsert:
            created = {key: value for key, value in query.items() if not key.startswith("$")}
            created.setdefault("_id", ObjectId())
            if "$set" in update:
                created.update(deepcopy(update["$set"]))
            self.docs.append(created)
            return UpdateResult(0, created["_id"])

        return UpdateResult(0)

    async def delete_one(self, query: dict[str, Any]):
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if not _matches(doc, query)]
        return UpdateResult(1 if len(self.docs) != before else 0)

    async def count_documents(self, query: dict[str, Any] | None = None) -> int:
        return len([doc for doc in self.docs if _matches(doc, query or {})])


class FakeDatabase:
    def __init__(self):
        self.collections: dict[str, AsyncCollection] = {}

    def __getitem__(self, name: str) -> AsyncCollection:
        self.collections.setdefault(name, AsyncCollection())
        return self.collections[name]


class FakeClient:
    def __init__(self):
        self.db = FakeDatabase()

    def get_default_database(self) -> FakeDatabase:
        return self.db

    def __getitem__(self, _name: str) -> FakeDatabase:
        return self.db


class FakeBlockchainManager:
    async def store_document(self, document_id: str, document_hash: str, metadata: dict[str, Any]):
        return {
            "success": True,
            "transaction_id": f"smoke-{document_id[:8]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "record": {"hash": document_hash, "metadata": metadata},
        }

    async def verify_document(self, document_id: str, document_hash: str):
        return {"success": True, "verified": True, "record": {"document_id": document_id, "hash": document_hash}}

    async def verify_hash(self, document_hash: str):
        return {"success": True, "verified": True, "record": {"hash": document_hash}}


def _matches(doc: dict[str, Any], query: dict[str, Any]) -> bool:
    for key, expected in query.items():
        if key == "$or":
            return any(_matches(doc, condition) for condition in expected)

        actual = doc.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$type" in expected:
                type_name = expected["$type"]
                if type_name == "string" and not isinstance(actual, str):
                    return False
            continue

        if actual != expected:
            return False
    return True


def _patch_test_environment(monkeypatch, tmp_path: Path) -> FakeClient:
    fake_client = FakeClient()
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()

    for module in (register_api, alumni_api, admin_api, documents_api, verification_api, document_requests_api):
        monkeypatch.setattr(module, "get_motor_client", lambda: fake_client)

    monkeypatch.setattr(documents_api, "_uploads_dir", lambda: uploads_root)
    monkeypatch.setattr(documents_api, "_backend_root", lambda: tmp_path)
    monkeypatch.setattr(alumni_api, "_uploads_dir", lambda: uploads_root)
    monkeypatch.setattr(document_requests_api, "_backend_root", lambda: tmp_path)
    monkeypatch.setattr(document_requests_api, "_uploads_root", lambda: uploads_root)
    monkeypatch.setattr(admin_api, "_uploads_dir", lambda: uploads_root)

    blockchain = FakeBlockchainManager()
    monkeypatch.setattr(admin_api, "get_blockchain_manager", lambda: blockchain)
    monkeypatch.setattr(verification_api, "get_blockchain_manager", lambda: blockchain)
    monkeypatch.setattr(document_requests_api, "get_blockchain_manager", lambda: blockchain)
    return fake_client


def _auth_header(user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def test_auth_smoke_register_login_and_me(monkeypatch, tmp_path):
    _patch_test_environment(monkeypatch, tmp_path)
    client = TestClient(app)

    payload = {
        "full_name": "Smoke Alumni",
        "email": "smoke@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    register_response = client.post("/api/v1/auth/register", json=payload)
    assert register_response.status_code == 200
    assert register_response.json()["success"] is True

    login_response = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == payload["email"]


def test_document_smoke_profile_upload_admin_approval_public_verification_request_and_download(monkeypatch, tmp_path):
    fake_client = _patch_test_environment(monkeypatch, tmp_path)
    client = TestClient(app)

    users = fake_client.db["users"]
    alumni_id = ObjectId()
    admin_id = ObjectId()
    now = datetime.now(timezone.utc)
    users.docs.extend(
        [
            {
                "_id": alumni_id,
                "full_name": "Smoke Alumni",
                "email": "alumni@example.com",
                "password_hash": "unused",
                "is_admin": False,
                "is_verified": True,
                "is_active": True,
            },
            {
                "_id": admin_id,
                "full_name": "Smoke Admin",
                "email": "admin@example.com",
                "password_hash": "unused",
                "is_admin": True,
                "is_verified": True,
                "is_active": True,
            },
        ]
    )
    alumni_user = users.docs[0]
    admin_user = users.docs[1]

    profile_response = client.put(
        f"/api/v1/alumni/{alumni_id}",
        headers=_auth_header(alumni_user),
        json={
            "user_id": str(alumni_id),
            "full_name": "Smoke Alumni",
            "email": "alumni@example.com",
            "student_id": "2026-0001",
            "course": "BSIT",
            "graduation_year": "2026",
        },
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["student_id"] == "2026-0001"

    picture_response = client.post(
        f"/api/v1/alumni/{alumni_id}/profile-picture",
        files={"profile_picture": ("avatar.png", b"avatar-bytes", "image/png")},
    )
    assert picture_response.status_code == 200
    assert picture_response.json()["path"].startswith("uploads/")

    file_bytes = b"document-smoke-test"
    upload_response = client.post(
        "/api/v1/documents/upload",
        headers=_auth_header(alumni_user),
        data={"alumni_id": str(alumni_id), "document_type": "diploma", "title": "Diploma"},
        files={"file": ("original diploma.pdf", file_bytes, "application/pdf")},
    )
    assert upload_response.status_code == 200
    document_id = upload_response.json()["document_id"]
    stored_path = upload_response.json()["file_path"]
    assert stored_path.startswith("uploads/smoke/diploma/")

    approval_response = client.post(
        f"/api/v1/admin/verifications/{document_id}/approve",
        headers=_auth_header(admin_user),
        json={"admin_notes": "Smoke approved"},
    )
    assert approval_response.status_code == 200
    assert approval_response.json()["verification_status"] == "verified"

    public_verify_response = client.post(
        "/api/v1/verification/blockchain/verify",
        json={"document_id": document_id, "hash": sha256(file_bytes).hexdigest()},
    )
    assert public_verify_response.status_code == 200
    assert public_verify_response.json()["verified"] is True

    request_response = client.post(
        "/api/v1/document-requests/",
        headers=_auth_header(alumni_user),
        json={"document_type": "diploma", "purpose": "Employment"},
    )
    assert request_response.status_code == 200
    request_id = request_response.json()["_id"]

    generate_response = client.post(
        f"/api/v1/document-requests/{request_id}/generate",
        headers=_auth_header(admin_user),
    )
    assert generate_response.status_code == 200
    assert generate_response.json()["success"] is True

    download_response = client.get(
        f"/api/v1/document-requests/{request_id}/download",
        headers=_auth_header(alumni_user),
    )
    assert download_response.status_code == 200
    assert download_response.content == file_bytes
