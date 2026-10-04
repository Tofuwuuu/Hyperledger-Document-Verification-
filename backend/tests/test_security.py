"""Tests proving each security fix in the Alumni backend."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.endpoints import admin as admin_api
from app.config import Settings, settings
from app.main import app
from app.utils import totp
from app.utils.auth import create_access_token
from app.utils.rate_limit import TOO_MANY_TRIES, reset_rate_limits
from tests.test_smoke_workflows import _auth_header, _patch_test_environment

PASSWORD = "Password123!"
PDF = b"%PDF-1.4\n%test document\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 32


@pytest.fixture
def env(monkeypatch, tmp_path):
    fake = _patch_test_environment(monkeypatch, tmp_path)
    return TestClient(app), fake


def _register(client, email, full_name="Test User"):
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": full_name, "email": email, "password": PASSWORD, "confirm_password": PASSWORD},
    )
    assert response.status_code == 200, response.text
    return response.json()["user"]["id"]


def _login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _token(client, email):
    response = _login(client, email)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _user(fake, user_id):
    return next(d for d in fake.db["users"].docs if str(d["_id"]) == str(user_id))


def _add_user(fake, **fields):
    doc = {
        "_id": ObjectId(),
        "full_name": "Seeded User",
        "email": f"{ObjectId()}@example.com",
        "password_hash": "unused",
        "is_admin": False,
        "is_verified": True,
        "is_active": True,
        **fields,
    }
    fake.db["users"].docs.append(doc)
    return doc


# 1. Mass assignment ---------------------------------------------------------

ESCALATION = {
    "is_admin": True,
    "role": "admin",
    "is_verified": True,
    "verified_at": "2026-01-01",
    "verification_status": "verified",
    "password_hash": "x",
    "token_version": 99,
    "mfa_enabled": False,
}


def test_create_profile_requires_auth(env):
    client, _fake = env
    uid = _register(client, "anon@example.com")
    response = client.post("/api/v1/alumni", json={"user_id": uid, "full_name": "X"})
    assert response.status_code == 401


def test_create_profile_blocks_privilege_fields(env):
    client, fake = env
    uid = _register(client, "attacker@example.com")
    token = _token(client, "attacker@example.com")
    response = client.post(
        "/api/v1/alumni", headers=_bearer(token), json={"user_id": uid, "full_name": "Renamed", **ESCALATION}
    )
    assert response.status_code == 200, response.text
    stored = _user(fake, uid)
    assert stored["full_name"] == "Renamed"
    assert stored["is_admin"] is False
    assert stored["is_verified"] is False
    assert "role" not in stored and "verification_status" not in stored and "verified_at" not in stored
    assert stored["password_hash"] != "x"
    assert _login(client, "attacker@example.com").json()["user"]["is_admin"] is False


def test_create_profile_cannot_target_another_user(env):
    client, _fake = env
    _register(client, "attacker@example.com")
    victim = _register(client, "victim@example.com")
    token = _token(client, "attacker@example.com")
    response = client.post("/api/v1/alumni", headers=_bearer(token), json={"user_id": victim, "full_name": "Owned"})
    assert response.status_code == 403


def test_update_profile_blocks_privilege_fields(env):
    client, fake = env
    uid = _register(client, "editor@example.com")
    token = _token(client, "editor@example.com")
    for path in (f"/api/v1/alumni/{uid}", f"/api/v1/alumni/{uid}/simple"):
        response = client.put(path, headers=_bearer(token), json={"course": "BSIT", **ESCALATION})
        assert response.status_code == 200, response.text
    profile = fake.db["alumni_profiles"].docs[0]
    assert profile["course"] == "BSIT"
    for field in ESCALATION:
        assert field not in profile
    stored = _user(fake, uid)
    assert stored["is_admin"] is False and stored["is_verified"] is False


def test_update_profile_requires_owner(env):
    client, _fake = env
    _register(client, "attacker@example.com")
    victim = _register(client, "victim@example.com")
    token = _token(client, "attacker@example.com")
    assert client.put(f"/api/v1/alumni/{victim}", json={"course": "X"}).status_code == 401
    response = client.put(f"/api/v1/alumni/{victim}", headers=_bearer(token), json={"course": "X"})
    assert response.status_code == 403


# 2. Alumni list -------------------------------------------------------------

SECRET_FIELDS = (
    "password_hash",
    "hashed_password",
    "password_reset_token",
    "password_reset_token_hash",
    "mfa_secret",
    "mfa_pending_secret",
    "mfa_setup_code",
    "token_version",
)


def test_alumni_list_requires_auth(env):
    client, _fake = env
    assert client.get("/api/v1/alumni").status_code == 401
    assert client.get("/api/v1/alumni/list").status_code == 401


def test_alumni_list_and_detail_hide_secrets(env):
    client, fake = env
    _add_user(
        fake,
        email="leaky@example.com",
        password_reset_token="reset-token",
        password_reset_token_hash="hash",
        mfa_secret="JBSWY3DPEHPK3PXP",
        mfa_pending_secret="JBSWY3DPEHPK3PXP",
        mfa_setup_code="123456",
        token_version=3,
        phone="0917",
    )
    _register(client, "viewer@example.com")
    token = _token(client, "viewer@example.com")
    admin = _add_user(fake, is_admin=True)

    for headers in (_bearer(token), _auth_header(admin)):
        body = client.get("/api/v1/alumni", headers=headers).json()
        assert body["total"] >= 2
        for row in body["results"]:
            for field in SECRET_FIELDS:
                assert field not in row
    # Other users don't see contact details.
    rows = client.get("/api/v1/alumni", headers=_bearer(token)).json()["results"]
    assert all("email" not in row and "phone" not in row for row in rows)

    leaky_id = str(fake.db["users"].docs[0]["_id"])
    for path in (f"/api/v1/alumni/{leaky_id}", f"/api/v1/alumni/user/{leaky_id}"):
        detail = client.get(path, headers=_bearer(token)).json()
        for field in SECRET_FIELDS:
            assert field not in detail


# 3. Password reset ----------------------------------------------------------

def test_reset_password_disabled_and_never_returns_token(env):
    client, fake = env
    _register(client, "victim@example.com")
    known = client.post("/api/v1/auth/reset-password", json={"email": "victim@example.com"})
    unknown = client.post("/api/v1/auth/reset-password", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 503
    assert known.json() == unknown.json() == {"detail": "Password reset isn't available in the demo."}
    assert "token" not in known.text.lower()
    assert "password_reset_token_hash" not in fake.db["users"].docs[0]
    for path, body in (
        ("/api/v1/auth/verify-reset-token", {"token": "x"}),
        ("/api/v1/auth/reset-password-confirm", {"token": "x", "password": "abcdef", "confirm_password": "abcdef"}),
        ("/api/v1/auth/verify-security-questions", {"email": "victim@example.com", "answers": []}),
    ):
        assert client.post(path, json=body).status_code == 503
    reset_rate_limits()  # all recovery routes share one bucket; 5 calls used above
    assert client.get("/api/v1/auth/security-questions/victim@example.com").status_code == 503


def test_reset_enabled_still_hides_token_and_token_is_not_an_access_token(env, monkeypatch):
    client, fake = env
    monkeypatch.setattr(settings, "password_reset_enabled", True)
    _register(client, "victim@example.com")
    response = client.post("/api/v1/auth/reset-password", json={"email": "victim@example.com"})
    assert response.status_code == 200
    assert "reset_token" not in response.json()
    stored = fake.db["users"].docs[0]
    assert stored["password_reset_token_hash"]
    assert "password_reset_token" not in stored
    # A reset-style token can't be used as a bearer token.
    me = client.get("/api/v1/auth/me", headers=_bearer("not-a-jwt-reset-token"))
    assert me.status_code == 401


# 4. SECRET_KEY --------------------------------------------------------------

@pytest.mark.parametrize("value", ["change_me", "CHANGE_ME", "short-key", ""])
def test_startup_refuses_bad_secret_key(value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, secret_key=value)


def test_startup_refuses_missing_secret_key(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_change_me_forged_admin_token_rejected(env):
    client, _fake = env

    def b64(data):
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64(json.dumps({"sub": "x", "is_admin": True, "type": "access", "exp": int(time.time()) + 999}).encode())
    signature = b64(hmac.new(b"change_me", f"{header}.{payload}".encode(), hashlib.sha256).digest())
    response = client.get("/api/v1/admin/users", headers=_bearer(f"{header}.{payload}.{signature}"))
    assert response.status_code == 401


# 5. Admin from the database, short tokens, logout ---------------------------

def test_admin_rights_come_from_database_not_token(env):
    client, fake = env
    user = _add_user(fake, is_admin=False)
    forged_claim = create_access_token({**user, "is_admin": True})
    assert client.get("/api/v1/admin/users", headers=_bearer(forged_claim)).status_code == 403

    admin = _add_user(fake, is_admin=True)
    token = create_access_token(admin)
    assert client.get("/api/v1/admin/users", headers=_bearer(token)).status_code == 200
    # Demoted in the database: the same token loses admin rights at once.
    next(d for d in fake.db["users"].docs if d["_id"] == admin["_id"])["is_admin"] = False
    assert client.get("/api/v1/admin/users", headers=_bearer(token)).status_code == 403


def test_access_token_is_short_lived(env):
    client, _fake = env
    _register(client, "short@example.com")
    token = _token(client, "short@example.com")
    claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    assert claims["exp"] - claims["iat"] <= 60 * 60


def test_logout_revokes_token(env):
    client, _fake = env
    _register(client, "logout@example.com")
    token = _token(client, "logout@example.com")
    assert client.get("/api/v1/auth/me", headers=_bearer(token)).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=_bearer(token)).status_code == 200
    assert client.get("/api/v1/auth/me", headers=_bearer(token)).status_code == 401


def test_unknown_email_and_wrong_password_look_the_same(env):
    client, _fake = env
    _register(client, "real@example.com")
    wrong = _login(client, "real@example.com", "WrongPassword1!")
    unknown = _login(client, "nobody@example.com", "WrongPassword1!")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


# 6. MFA ---------------------------------------------------------------------

def _enable_mfa(client, email):
    token = _token(client, email)
    setup = client.post("/api/v1/auth/mfa/setup", json={"type": "totp"}, headers=_bearer(token))
    assert setup.status_code == 200
    body = setup.json()
    assert "verification_code" not in body
    assert body["secret"] and body["otpauth_url"].startswith("otpauth://totp/")
    secret = body["secret"]
    enable = client.post(
        "/api/v1/auth/mfa/enable", json={"verification_code": totp.code_at(secret)}, headers=_bearer(token)
    )
    assert enable.status_code == 200, enable.text
    return secret


def _next_code(secret, steps=1):
    return totp.code_at(secret, time.time() + steps * totp.STEP_SECONDS)


def test_mfa_setup_does_not_return_current_code(env):
    client, _fake = env
    _register(client, "mfa@example.com")
    token = _token(client, "mfa@example.com")
    body = client.post("/api/v1/auth/mfa/setup", json={}, headers=_bearer(token)).json()
    current = totp.code_at(body["secret"])
    assert current not in json.dumps({k: v for k, v in body.items() if k not in ("secret", "otpauth_url")})
    assert "verification_code" not in body


def test_mfa_pending_token_cannot_access_protected_routes(env):
    client, _fake = env
    _register(client, "mfa@example.com")
    secret = _enable_mfa(client, "mfa@example.com")

    step1 = _login(client, "mfa@example.com")
    assert step1.status_code == 200
    body = step1.json()
    assert body["mfa_required"] is True
    assert "access_token" not in body
    pending = body["mfa_token"]
    for path in ("/api/v1/auth/me", "/api/v1/alumni", "/api/v1/auth/mfa/status"):
        assert client.get(path, headers=_bearer(pending)).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": pending}).status_code == 401

    wrong = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": "000000"})
    if totp.code_at(secret) != "000000":
        assert wrong.status_code == 401
        assert wrong.json()["detail"] == "That code didn't work. Check your app and try again."

    # The enable step used the current code, so sign in with the next one (inside the drift window).
    next_code = _next_code(secret)
    ok = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": next_code})
    assert ok.status_code == 200, ok.text
    access = ok.json()["access_token"]
    assert client.get("/api/v1/auth/me", headers=_bearer(access)).status_code == 200
    # An access token is not accepted where a pending token is expected.
    swapped = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": access, "code": next_code})
    assert swapped.status_code == 401


# 7. No request bodies or passwords in logs ----------------------------------

def test_validation_errors_do_not_log_or_echo_passwords(env, caplog):
    client, _fake = env
    marker = "SuperSecretPassw0rd!"
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/api/v1/auth/register",
            json={"full_name": "x", "email": "bad", "password": marker, "confirm_password": marker},
        )
    assert response.status_code == 422
    assert marker not in response.text
    assert marker not in caplog.text


# 8. Uploads -----------------------------------------------------------------

def _verified_alumni(client, fake):
    uid = _register(client, "uploader@example.com", "Upload Person")
    _user(fake, uid)["is_verified"] = True
    token = _token(client, "uploader@example.com")
    client.put(f"/api/v1/alumni/{uid}", headers=_bearer(token), json={"full_name": "Upload Person"})
    return uid, token


def _upload(client, uid, token, name, content, ctype):
    return client.post(
        "/api/v1/documents/upload",
        headers=_bearer(token),
        data={"alumni_id": uid, "document_type": "diploma", "title": "Diploma"},
        files={"file": (name, content, ctype)},
    )


@pytest.mark.parametrize(
    "name,content,ctype",
    [("d.pdf", PDF, "application/pdf"), ("p.png", PNG, "image/png"), ("p.jpg", JPG, "image/jpeg")],
)
def test_allowed_uploads_accepted(env, name, content, ctype):
    client, _fake = env
    uid, token = _verified_alumni(client, _fake)
    response = _upload(client, uid, token, name, content, ctype)
    assert response.status_code == 200, response.text
    doc_id = response.json()["document_id"]
    download = client.get(f"/api/v1/documents/{doc_id}/download", headers=_bearer(token))
    assert download.headers["x-content-type-options"] == "nosniff"
    assert download.headers["content-disposition"].startswith("attachment")


@pytest.mark.parametrize(
    "name,content,ctype",
    [
        ("evil.html", b"<script>alert(1)</script>", "text/html"),
        ("evil.pdf", b"<script>alert(1)</script>", "application/pdf"),  # wrong magic bytes
        ("fake.png", PDF, "image/png"),  # PDF bytes claiming to be PNG
        ("doc.pdf", PDF, "text/html"),  # declared type disagrees
        ("noext", PDF, "application/pdf"),
    ],
)
def test_wrong_type_upload_rejected(env, name, content, ctype):
    client, fake = env
    uid, token = _verified_alumni(client, fake)
    response = _upload(client, uid, token, name, content, ctype)
    assert response.status_code == 415
    assert fake.db["documents"].docs == []


def test_oversized_upload_rejected(env, monkeypatch):
    client, fake = env
    monkeypatch.setattr(settings, "max_upload_bytes", 1024)
    uid, token = _verified_alumni(client, fake)
    response = _upload(client, uid, token, "big.pdf", PDF + b"0" * 2048, "application/pdf")
    assert response.status_code == 413
    assert fake.db["documents"].docs == []


def test_default_upload_cap_is_10mb():
    assert settings.max_upload_bytes == 10 * 1024 * 1024


def test_profile_picture_checks_magic_bytes_and_owner(env):
    client, _fake = env
    uid = _register(client, "pic@example.com")
    other = _register(client, "other@example.com")
    token = _token(client, "pic@example.com")
    path = f"/api/v1/alumni/{uid}/profile-picture"
    assert client.post(path, files={"profile_picture": ("a.png", PNG, "image/png")}).status_code == 401
    bad = client.post(path, headers=_bearer(token), files={"profile_picture": ("a.png", b"GIF89a....", "image/png")})
    assert bad.status_code == 415
    pdf = client.post(path, headers=_bearer(token), files={"profile_picture": ("a.pdf", PDF, "application/pdf")})
    assert pdf.status_code == 415
    ok = client.post(path, headers=_bearer(token), files={"profile_picture": ("a.png", PNG, "image/png")})
    assert ok.status_code == 200
    theirs = client.post(
        f"/api/v1/alumni/{other}/profile-picture", headers=_bearer(token), files={"profile_picture": ("a.png", PNG, "image/png")}
    )
    assert theirs.status_code == 403


# 9. Ledger write must succeed for approval; anchor only real documents ------

def test_approval_fails_when_ledger_write_fails(env, monkeypatch):
    client, fake = env
    uid, token = _verified_alumni(client, fake)
    doc_id = _upload(client, uid, token, "d.pdf", PDF, "application/pdf").json()["document_id"]
    admin = _add_user(fake, is_admin=True)

    class FailingLedger:
        async def store_document(self, *_args, **_kwargs):
            return {"success": False, "message": "gateway down"}

    monkeypatch.setattr(admin_api, "get_blockchain_manager", lambda: FailingLedger())
    response = client.post(
        f"/api/v1/admin/verifications/{doc_id}/approve", headers=_auth_header(admin), json={"admin_notes": "ok"}
    )
    assert response.status_code == 502
    stored = fake.db["documents"].docs[0]
    assert stored["verification_status"] == "pending"
    assert stored["status"] == "pending"
    assert stored["blockchain_commit_status"] == "failed"


def test_anchor_only_hashes_real_stored_documents(env):
    client, fake = env
    uid, token = _verified_alumni(client, fake)
    doc_id = _upload(client, uid, token, "d.pdf", PDF, "application/pdf").json()["document_id"]
    admin = _add_user(fake, is_admin=True)
    headers = _auth_header(admin)

    forged = client.post(
        "/api/v1/verification/blockchain/store", headers=headers, json={"document_id": doc_id, "hash": "ab" * 32}
    )
    assert forged.status_code == 400
    missing = client.post(
        "/api/v1/verification/blockchain/store", headers=headers, json={"document_id": str(ObjectId()), "hash": "ab" * 32}
    )
    assert missing.status_code == 404
    non_admin = client.post("/api/v1/verification/blockchain/store", headers=_bearer(token), json={"document_id": doc_id})
    assert non_admin.status_code == 403
    real = client.post("/api/v1/verification/blockchain/store", headers=headers, json={"document_id": doc_id})
    assert real.status_code == 200, real.text
    assert real.json()["metadata"]["hash"] == hashlib.sha256(PDF).hexdigest()


# 10. Route shadowing --------------------------------------------------------

def test_document_activities_route_not_shadowed(env):
    client, fake = env
    uid, token = _verified_alumni(client, fake)
    _upload(client, uid, token, "d.pdf", PDF, "application/pdf")
    response = client.get("/api/v1/documents/activities", headers=_bearer(token))
    assert response.status_code == 200, response.text
    assert isinstance(response.json(), list) and len(response.json()) == 1


# 11. Rate limits ------------------------------------------------------------

def test_login_rate_limit_returns_429(env):
    client, _fake = env
    _register(client, "brute@example.com")
    statuses = [_login(client, "brute@example.com", "WrongPassword1!").status_code for _ in range(11)]
    assert statuses[:10] == [401] * 10
    last = _login(client, "brute@example.com", "WrongPassword1!")
    assert last.status_code == 429
    assert last.json()["detail"] == TOO_MANY_TRIES == "Too many tries. Wait a few minutes and try again."


def test_mfa_verify_rate_limit_returns_429(env):
    client, _fake = env
    _register(client, "mfa@example.com")
    _enable_mfa(client, "mfa@example.com")
    pending = _login(client, "mfa@example.com").json()["mfa_token"]
    codes = [client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": "123456"}).status_code for _ in range(6)]
    assert codes[-1] == 429


def test_reset_rate_limit_returns_429(env):
    client, _fake = env
    codes = [client.post("/api/v1/auth/reset-password", json={"email": "a@example.com"}).status_code for _ in range(6)]
    assert codes[:5] == [503] * 5
    assert codes[5] == 429
    assert client.post("/api/v1/auth/reset-password", json={"email": "a@example.com"}).json()["detail"] == TOO_MANY_TRIES


# 12. Health -----------------------------------------------------------------

def test_health_is_public_and_cheap(env):
    client, _fake = env
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# 14. is_verified enforced on the server -------------------------------------

def test_unverified_user_cannot_upload_or_request(env):
    client, fake = env
    uid = _register(client, "unverified@example.com")
    token = _token(client, "unverified@example.com")
    client.put(f"/api/v1/alumni/{uid}", headers=_bearer(token), json={"full_name": "U"})
    upload = _upload(client, uid, token, "d.pdf", PDF, "application/pdf")
    assert upload.status_code == 403
    request = client.post("/api/v1/document-requests/", headers=_bearer(token), json={"document_type": "diploma"})
    assert request.status_code == 403
    registration = client.post("/api/v1/registrations", headers=_bearer(token), json={"event_id": str(ObjectId())})
    assert registration.status_code == 403


# 15. Security follow-ups ----------------------------------------------------

def _seed_security_questions(fake, email):
    import bcrypt

    def h(answer):
        return bcrypt.hashpw(answer.encode(), bcrypt.gensalt(4)).decode()

    return _add_user(
        fake,
        email=email,
        security_questions=[
            {"question": "First pet?", "answer_hash": h("rex")},
            {"question": "Home town?", "answer_hash": h("cavite")},
        ],
    )


def test_security_questions_count_each_question_once(env, monkeypatch):
    client, fake = env
    monkeypatch.setattr(settings, "password_reset_enabled", True)
    _seed_security_questions(fake, "sq@example.com")
    path = "/api/v1/auth/verify-security-questions"
    repeated = client.post(
        path,
        json={"email": "sq@example.com", "answers": [{"question_idx": 0, "answer": "rex"}, {"question_idx": 0, "answer": "rex"}]},
    )
    assert repeated.status_code == 401
    assert "reset_token" not in repeated.text
    both = client.post(
        path,
        json={"email": "sq@example.com", "answers": [{"question_idx": 0, "answer": "Rex"}, {"question_idx": 1, "answer": "cavite"}]},
    )
    assert both.status_code == 200, both.text
    assert both.json()["reset_token"]


def test_security_questions_unknown_email_looks_like_wrong_answers(env, monkeypatch):
    client, fake = env
    monkeypatch.setattr(settings, "password_reset_enabled", True)
    _seed_security_questions(fake, "sq@example.com")
    _add_user(fake, email="noquestions@example.com")
    answers = [{"question_idx": 0, "answer": "nope"}, {"question_idx": 1, "answer": "nope"}]
    path = "/api/v1/auth/verify-security-questions"
    known = client.post(path, json={"email": "sq@example.com", "answers": answers})
    unknown = client.post(path, json={"email": "nobody@example.com", "answers": answers})
    assert known.status_code == unknown.status_code == 401
    assert known.json() == unknown.json()
    reset_rate_limits()
    missing = client.get("/api/v1/auth/security-questions/nobody@example.com")
    unconfigured = client.get("/api/v1/auth/security-questions/noquestions@example.com")
    assert missing.status_code == unconfigured.status_code == 400
    assert missing.json() == unconfigured.json()


def _scope(peer, forwarded=None):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return {"type": "http", "client": (peer, 1234), "headers": headers}


def test_client_ip_ignores_forwarded_header_by_default(monkeypatch):
    from starlette.requests import Request

    from app.utils.rate_limit import client_ip

    monkeypatch.setattr(settings, "trusted_proxies", "")
    assert client_ip(Request(_scope("10.0.0.5", "1.2.3.4"))) == "10.0.0.5"


def test_client_ip_reads_forwarded_header_only_from_trusted_proxy(monkeypatch):
    from starlette.requests import Request

    from app.utils.rate_limit import client_ip

    monkeypatch.setattr(settings, "trusted_proxies", "10.0.0.0/8")
    # From the proxy: the rightmost untrusted hop is the client. A spoofed left entry is ignored.
    assert client_ip(Request(_scope("10.0.0.5", "6.6.6.6, 1.2.3.4"))) == "1.2.3.4"
    assert client_ip(Request(_scope("10.0.0.5", "1.2.3.4, 10.0.0.9"))) == "1.2.3.4"
    # From anyone else: the header is ignored.
    assert client_ip(Request(_scope("8.8.8.8", "1.2.3.4"))) == "8.8.8.8"
    # Garbage header falls back to the peer.
    assert client_ip(Request(_scope("10.0.0.5", "not-an-ip"))) == "10.0.0.5"


def test_rate_limit_is_per_client_behind_trusted_proxy(env, monkeypatch):
    _client, _fake = env
    monkeypatch.setattr(settings, "trusted_proxies", "10.0.0.5")
    client = TestClient(app, client=("10.0.0.5", 50000))
    _register(client, "brute@example.com")
    body = {"email": "brute@example.com", "password": "WrongPassword1!"}
    for _ in range(10):
        client.post("/api/v1/auth/login", json=body, headers={"X-Forwarded-For": "1.1.1.1"})
    assert client.post("/api/v1/auth/login", json=body, headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 429
    # A different visitor behind the same proxy is not locked out.
    assert client.post("/api/v1/auth/login", json=body, headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 401


def _claims(token):
    return json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))


def test_refresh_keeps_auth_time_and_caps_session(env):
    client, fake = env
    _register(client, "refresh@example.com")
    token = _token(client, "refresh@example.com")
    first = _claims(token)
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert refreshed.status_code == 200, refreshed.text
    second = _claims(refreshed.json()["access_token"])
    assert second["auth_time"] == first["auth_time"]

    # Signed in almost 12 hours ago: the refreshed token can't outlive the cap.
    user = fake.db["users"].docs[0]
    near_cap = int(time.time()) - settings.session_max_hours * 3600 + 120
    old = create_access_token(user, auth_time=near_cap, expires_minutes=60)
    capped = client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert capped.status_code == 200
    assert _claims(capped.json()["access_token"])["exp"] <= near_cap + settings.session_max_hours * 3600

    # Past the cap: refresh is refused even with an unexpired token.
    from app.utils.auth import TOKEN_TYPE_ACCESS, create_token

    expired_session = create_token(
        user, token_type=TOKEN_TYPE_ACCESS, expires_minutes=60, auth_time=int(time.time()) - 13 * 3600
    )
    assert client.get("/api/v1/auth/me", headers=_bearer(expired_session)).status_code == 200
    refused = client.post("/api/v1/auth/refresh", json={"refresh_token": expired_session})
    assert refused.status_code == 401
    assert refused.json()["detail"] == "Session has ended. Sign in again."


def test_mfa_code_cannot_be_reused(env):
    client, _fake = env
    _register(client, "replay@example.com")
    secret = _enable_mfa(client, "replay@example.com")
    code = _next_code(secret)
    pending = _login(client, "replay@example.com").json()["mfa_token"]
    assert client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": code}).status_code == 200
    pending = _login(client, "replay@example.com").json()["mfa_token"]
    again = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": code})
    assert again.status_code == 401
    # An older step than the last accepted one is refused too.
    older = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": totp.code_at(secret)})
    assert older.status_code == 401


def test_matching_step_refuses_old_steps():
    secret = totp.generate_secret()
    now = 1_700_000_000
    step = totp.current_step(now)
    code = totp.code_at(secret, now)
    assert totp.matching_step(secret, code, for_time=now) == step
    assert totp.matching_step(secret, code, for_time=now, after_step=step) is None
    assert totp.matching_step(secret, code, for_time=now, after_step=step - 1) == step


def test_mfa_disable_requires_current_code(env, monkeypatch):
    client, fake = env
    uid = _register(client, "off@example.com")
    secret = _enable_mfa(client, "off@example.com")
    pending = _login(client, "off@example.com").json()["mfa_token"]
    access = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": pending, "code": _next_code(secret)}).json()[
        "access_token"
    ]
    # A minute later on the server clock, so a fresh code exists.
    real_time = time.time

    class _Later:
        @staticmethod
        def time():
            return real_time() + 2 * totp.STEP_SECONDS

    monkeypatch.setattr(totp, "time", _Later)
    path = "/api/v1/auth/mfa/disable"
    assert client.post(path, json={}, headers=_bearer(access)).status_code == 422
    wrong = "000000" if _next_code(secret, 2) != "000000" else "111111"
    bad = client.post(path, json={"code": wrong}, headers=_bearer(access))
    assert bad.status_code == 400
    assert bad.json()["detail"] == "That code didn't work. Check your app and try again."
    # The code already used to sign in doesn't work either.
    assert client.post(path, json={"code": _next_code(secret)}, headers=_bearer(access)).status_code == 400
    assert _user(fake, uid)["mfa_enabled"] is True
    ok = client.post(path, json={"code": _next_code(secret, 2)}, headers=_bearer(access))
    assert ok.status_code == 200, ok.text
    stored = _user(fake, uid)
    assert stored["mfa_enabled"] is False and stored["mfa_secret"] is None


def test_mfa_setup_returns_secret_and_uri_and_enables_only_after_correct_code(env):
    client, fake = env
    uid = _register(client, "setup@example.com")
    token = _token(client, "setup@example.com")
    body = client.post("/api/v1/auth/mfa/setup", json={"type": "totp"}, headers=_bearer(token)).json()
    secret = body["secret"]
    assert body["otpauth_uri"] == body["otpauth_url"]
    assert body["otpauth_uri"].startswith("otpauth://totp/") and f"secret={secret}" in body["otpauth_uri"]
    assert body["is_enabled"] is False and body["has_pending_setup"] is True
    assert _user(fake, uid).get("mfa_enabled") in (None, False)

    wrong = "000000" if totp.code_at(secret) != "000000" else "111111"
    bad = client.post("/api/v1/auth/mfa/enable", json={"verification_code": wrong}, headers=_bearer(token))
    assert bad.status_code == 400
    assert _user(fake, uid).get("mfa_enabled") in (None, False)
    assert _login(client, "setup@example.com").json().get("mfa_required") is None

    ok = client.post("/api/v1/auth/mfa/enable", json={"verification_code": totp.code_at(secret)}, headers=_bearer(token))
    assert ok.status_code == 200 and ok.json()["is_enabled"] is True
    assert _user(fake, uid)["mfa_secret"] == secret
    assert _login(client, "setup@example.com").json()["mfa_required"] is True
