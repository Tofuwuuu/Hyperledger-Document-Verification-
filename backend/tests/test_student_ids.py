import asyncio

from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from app.db import student_ids
from app.db.student_ids import ensure_student_id_index, find_duplicate_groups, normalize_student_id
from app.main import app
from scripts.normalize_student_ids import build_plan, format_summary, run as run_script
from tests.test_smoke_workflows import AsyncCursor, _auth_header, _patch_test_environment


def _two_users(fake_client):
    users = fake_client.db["users"]
    ids = (ObjectId(), ObjectId())
    for user_id, email in zip(ids, ("one@example.com", "two@example.com")):
        users.docs.append({"_id": user_id, "full_name": email, "email": email, "password_hash": "unused",
                           "is_admin": False, "is_verified": True, "is_active": True})
    return ids, users.docs[0], users.docs[1]


def test_normalize_student_id():
    assert normalize_student_id("  ab-123 ") == "AB-123"
    assert normalize_student_id(None) is None
    assert find_duplicate_groups([{"_id": 1, "student_id": "ab-123"}, {"_id": 2, "student_id": "AB-123 "},
                                  {"_id": 3, "student_id": ""}, {"_id": 4, "student_id": "x"}]) == {"AB-123": ["1", "2"]}


def test_saves_store_normalized_student_id_and_normalized_values_collide(monkeypatch, tmp_path):
    fake_client = _patch_test_environment(monkeypatch, tmp_path)
    client = TestClient(app)
    (first_id, second_id), first, second = _two_users(fake_client)

    saved = client.put(f"/api/v1/alumni/{first_id}", headers=_auth_header(first),
                       json={"user_id": str(first_id), "student_id": " ab-123 "})
    assert saved.status_code == 200
    assert saved.json()["student_id"] == "AB-123"

    clash = client.put(f"/api/v1/alumni/{second_id}/simple", headers=_auth_header(second),
                       json={"user_id": str(second_id), "student_id": "AB-123 "})
    assert clash.status_code == 409
    assert clash.json()["detail"][0]["loc"] == ["body", "student_id"]

    # A value stored before normalization still collides.
    fake_client.db["alumni_profiles"].docs[0]["student_id"] = "ab-123 "
    clash = client.post("/api/v1/alumni", headers=_auth_header(second),
                        json={"user_id": str(second_id), "student_id": "AB-123"})
    assert clash.status_code == 409

    created = client.post("/api/v1/alumni/simple", headers=_auth_header(second),
                          json={"user_id": str(second_id), "student_id": " cd-9 "})
    assert created.status_code == 200
    assert fake_client.db["users"].docs[1]["student_id"] == "CD-9"


def test_duplicate_key_error_is_mapped_to_409_on_every_save_endpoint(monkeypatch, tmp_path):
    fake_client = _patch_test_environment(monkeypatch, tmp_path)
    client = TestClient(app)
    (first_id, _), first, _ = _two_users(fake_client)

    async def raise_duplicate(*_args, **_kwargs):
        # What the unique index raises when a concurrent save wins the race.
        raise DuplicateKeyError("E11000 duplicate key error", 11000,
                                {"keyPattern": {"student_id": 1}, "keyValue": {"student_id": "AB-1"}})

    monkeypatch.setattr(fake_client.db["alumni_profiles"], "update_one", raise_duplicate)
    monkeypatch.setattr(fake_client.db["users"], "update_one", raise_duplicate)
    body = {"user_id": str(first_id), "student_id": "AB-1"}
    for method, path in (("put", f"/api/v1/alumni/{first_id}"), ("put", f"/api/v1/alumni/{first_id}/simple"),
                         ("post", "/api/v1/alumni"), ("post", "/api/v1/alumni/simple")):
        response = getattr(client, method)(path, headers=_auth_header(first), json=body)
        assert response.status_code == 409, path
        assert response.json()["detail"][0]["loc"] == ["body", "student_id"]


class _IndexCollection:
    def __init__(self, docs, indexes=None):
        self.docs = docs
        self.indexes = dict(indexes or {"_id_": {}})
        self.created = []
        self.dropped = []

    def find(self, *_args, **_kwargs):
        return AsyncCursor([d for d in self.docs if isinstance(d.get("student_id"), str)])

    async def index_information(self):
        return self.indexes

    async def create_index(self, keys, name, **kwargs):
        self.created.append((name, kwargs))
        self.indexes[name] = {"key": keys, **kwargs}

    async def drop_index(self, name):
        self.dropped.append(name)
        self.indexes.pop(name, None)


def test_ensure_index_skips_on_normalized_duplicates_and_logs_ids(caplog):
    coll = _IndexCollection([{"_id": "p1", "student_id": "ab-1"}, {"_id": "p2", "student_id": " AB-1"},
                             {"_id": "p3", "student_id": "CD-2"}],
                            {"_id_": {}, student_ids.LEGACY_INDEX_NAME: {}})
    assert asyncio.run(ensure_student_id_index(coll)) is False
    assert coll.created == [] and coll.dropped == []
    assert "AB-1: profiles p1, p2" in caplog.text


def test_ensure_index_creates_unique_partial_index_once():
    coll = _IndexCollection([{"_id": "p1", "student_id": "AB-1"}, {"_id": "p2", "student_id": ""}],
                            {"_id_": {}, student_ids.LEGACY_INDEX_NAME: {}})
    assert asyncio.run(ensure_student_id_index(coll)) is True
    assert coll.dropped == [student_ids.LEGACY_INDEX_NAME]
    name, kwargs = coll.created[0]
    assert name == student_ids.UNIQUE_INDEX_NAME
    assert kwargs == {"unique": True, "partialFilterExpression": {"student_id": {"$type": "string", "$gt": ""}}}
    # Idempotent: a second startup changes nothing.
    assert asyncio.run(ensure_student_id_index(coll)) is True
    assert len(coll.created) == 1


def test_script_dry_run_and_apply_never_touch_colliding_groups():
    docs = [{"_id": "p1", "student_id": "ab-1"}, {"_id": "p2", "student_id": "AB-1 "},
            {"_id": "p3", "student_id": " cd-2"}, {"_id": "p4", "student_id": "EF-3"}, {"_id": "p5", "student_id": 42}]
    plan = build_plan(docs)
    assert plan.collisions == {"AB-1": ["p1", "p2"]}
    assert plan.updates == [("p3", " cd-2", "CD-2")]
    assert plan.already_normalized == 1 and plan.skipped_non_string == 1
    assert "dry run, nothing written" in format_summary(plan, applied=False)

    class Coll:
        def __init__(self):
            self.docs = [dict(d) for d in docs]
            self.writes = []

        def find(self, *_a, **_k):
            return AsyncCursor([dict(d) for d in self.docs])

        async def update_one(self, query, update):
            self.writes.append((query, update))
            for d in self.docs:
                if d["_id"] == query["_id"] and d["student_id"] == query["student_id"]:
                    d.update(update["$set"])

    dry = Coll()
    asyncio.run(run_script(dry, apply=False))
    assert dry.writes == []

    applied = Coll()
    asyncio.run(run_script(applied, apply=True))
    assert applied.writes == [({"_id": "p3", "student_id": " cd-2"}, {"$set": {"student_id": "CD-2"}})]
    assert [d["student_id"] for d in applied.docs] == ["ab-1", "AB-1 ", "CD-2", "EF-3", 42]
    assert len(applied.docs) == 5  # nothing deleted or merged
