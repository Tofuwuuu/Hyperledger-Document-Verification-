import asyncio
import pathlib
import sys

import httpx
from httpx import ASGITransport

import pytest

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402


class FakeDocumentsCollection:
    def __init__(self):
        self.docs = {}

    async def find_one(self, query):
        _id = query.get("_id")
        return self.docs.get(str(_id))

    async def update_one(self, query, update):
        _id = query.get("_id")
        doc = self.docs.get(str(_id))
        if not doc:
            return
        doc.update(update.get("$set", {}))

    async def insert_one(self, doc):
        class R:
            inserted_id = "507f1f77bcf86cd799439099"

        self.docs[str(R.inserted_id)] = {**doc, "_id": R.inserted_id}
        return R()


class FakeAuditCollection:
    def __init__(self):
        self.logs = []

    async def insert_one(self, doc):
        self.logs.append(doc)


class FakeDB:
    def __init__(self, docs_col, audit_col):
        self.docs_col = docs_col
        self.audit_col = audit_col

    def __getitem__(self, name: str):
        if name == "documents":
            return self.docs_col
        if name == "audit_logs":
            return self.audit_col
        raise KeyError(name)


class FakeClient:
    def __init__(self, db: FakeDB):
        self.db = db

    def get_default_database(self):
        return self.db


def test_reject_document_admin(monkeypatch: pytest.MonkeyPatch):
    from bson import ObjectId

    fake_docs = FakeDocumentsCollection()
    fake_audit = FakeAuditCollection()
    fake_db = FakeDB(fake_docs, fake_audit)
    fake_client = FakeClient(fake_db)

    # seed a document
    doc_id = "507f1f77bcf86cd799439011"
    fake_docs.docs[doc_id] = {"_id": doc_id, "user_id": "507f1f77bcf86cd799439022", "title": "Test Doc"}

    import app.api.endpoints.documents as docs_mod

    monkeypatch.setattr(docs_mod, "get_motor_client", lambda: fake_client)
    # override low-level auth dependency used inside _require_auth via FastAPI dependency_overrides
    async def _fake_get_current_user():
        return {"sub": "admin", "is_admin": True}
    import app.utils.auth as auth_mod
    from app.main import app as main_app
    main_app.dependency_overrides[auth_mod.get_current_user] = _fake_get_current_user

    async def run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/v1/documents/{doc_id}/reject", json={"reason": "Not valid"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["status"] == "rejected"
            # check document updated
            updated = fake_docs.docs.get(doc_id)
            assert updated.get("verification_status") == "rejected"
            assert updated.get("rejection_reason") == "Not valid"
            # audit log written
            assert len(fake_audit.logs) == 1

    asyncio.run(run())
