import pathlib
import sys

backend_root = str(pathlib.Path(__file__).resolve().parents[1])
sys.path.insert(0, backend_root)

from bson import ObjectId  # noqa: E402

from app.api.endpoints.alumni import _merge_profile_with_user  # noqa: E402


def test_merge_profile_with_user_falls_back_for_missing_profile_fields():
    user_id = ObjectId("69d890b1272ffdcbc83d7176")
    profile = {
        "_id": ObjectId("69e8443a162525f0ec57f0cb"),
        "user_id": user_id,
        "full_name": "",
        "email": "",
        "student_id": "",
        "phone": "",
        "civil_status": "",
        "bio": "",
    }
    user = {
        "_id": user_id,
        "full_name": "Sophia Ramirez",
        "email": "sophia.ramirez@example.com",
        "student_id": "2101088234",
        "phone": "09123456789",
        "civil_status": "single",
        "bio": "Updated from users collection",
        "is_admin": False,
        "is_verified": False,
    }

    merged = _merge_profile_with_user(profile, user)

    assert merged["id"] == str(profile["_id"])
    assert merged["user_id"] == str(user_id)
    assert merged["full_name"] == "Sophia Ramirez"
    assert merged["email"] == "sophia.ramirez@example.com"
    assert merged["student_id"] == "2101088234"
    assert merged["phone"] == "09123456789"
    assert merged["civil_status"] == "single"
    assert merged["bio"] == "Updated from users collection"


def test_merge_profile_with_user_keeps_profile_values_when_present():
    user_id = ObjectId("69d890b1272ffdcbc83d7176")
    profile = {
        "_id": ObjectId("69e8443a162525f0ec57f0cb"),
        "user_id": user_id,
        "student_id": "PROFILE-123",
        "phone": "09998887777",
    }
    user = {
        "_id": user_id,
        "student_id": "USER-999",
        "phone": "09123456789",
        "is_admin": False,
        "is_verified": False,
    }

    merged = _merge_profile_with_user(profile, user)

    assert merged["student_id"] == "PROFILE-123"
    assert merged["phone"] == "09998887777"
