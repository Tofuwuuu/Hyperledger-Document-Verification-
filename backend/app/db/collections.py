from __future__ import annotations

from typing import Any


def get_default_db(client: Any):
    try:
        return client.get_default_database()
    except Exception:
        return client["cvsu_alumni"]


def users_collection(client: Any):
    return get_default_db(client)["users"]


def alumni_profiles_collection(client: Any):
    return get_default_db(client)["alumni_profiles"]


def documents_collection(client: Any):
    return get_default_db(client)["documents"]


def document_requests_collection(client: Any):
    return get_default_db(client)["document_requests"]


def events_collection(client: Any):
    return get_default_db(client)["events"]


def event_registrations_collection(client: Any):
    return get_default_db(client)["event_registrations"]
