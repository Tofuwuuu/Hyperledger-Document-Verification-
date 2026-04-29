import asyncio
import pathlib
import sys

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from bson import ObjectId  # noqa: E402

from app.api.endpoints.alumni import update_alumni_profile  # noqa: E402
from app.schemas.alumni_profile import AlumniProfileUpdate  # noqa: E402


class FakeUpdateResult:
    def __init__(self, matched_count: int):
        self.matched_count = matched_count


class FakeProfilesCollection:
    def __init__(self, profile_doc):
        self.profile_doc = profile_doc
        self.last_update = None

    async def find_one(self, query):
        if query.get("_id") == self.profile_doc["_id"]:
            return self.profile_doc
        if query.get("user_id") == self.profile_doc["user_id"]:
            return self.profile_doc
        return None

    async def update_one(self, query, update):
        self.last_update = {"query": query, "update": update}
        self.profile_doc.update(update.get("$set", {}))
        return FakeUpdateResult(1)


class FakeUsersCollection:
    def __init__(self, user_doc):
        self.user_doc = user_doc
        self.last_update = None

    async def update_one(self, query, update):
        self.last_update = {"query": query, "update": update}
        self.user_doc.update(update.get("$set", {}))

    async def find_one(self, query):
        if query.get("_id") == self.user_doc["_id"]:
            return self.user_doc
        return None


def test_update_alumni_profile_ignores_identifier_fields(monkeypatch):
    profile_id = ObjectId("69e8443a162525f0ec57f0cb")
    user_id = ObjectId("69e8443a162525f0ec57f0ca")
    fake_profile = {"_id": profile_id, "user_id": user_id, "full_name": "Before"}
    fake_user = {"_id": user_id, "full_name": "Before", "email": "before@example.com"}
    fake_profiles = FakeProfilesCollection(fake_profile)
    fake_users = FakeUsersCollection(fake_user)

    import app.api.endpoints.alumni as alumni

    monkeypatch.setattr(alumni, "get_motor_client", lambda: object())
    monkeypatch.setattr(alumni, "alumni_profiles_collection", lambda client: fake_profiles)
    monkeypatch.setattr(alumni, "users_collection", lambda client: fake_users)

    payload = AlumniProfileUpdate(
        _id=str(profile_id),
        id=str(profile_id),
        user_id=str(user_id),
        full_name="After",
        email="After@Example.com",
    )

    async def run():
        result = await update_alumni_profile(str(profile_id), payload)

        set_data = fake_profiles.last_update["update"]["$set"]
        assert "_id" not in set_data
        assert "id" not in set_data
        assert "user_id" not in set_data
        assert set_data["full_name"] == "After"
        assert set_data["email"] == "after@example.com"
        assert result["id"] == str(profile_id)
        assert result["full_name"] == "After"

    asyncio.run(run())
