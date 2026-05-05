from __future__ import annotations

import re

DOCUMENT_TYPE_OPTIONS: list[dict[str, str]] = [
    {"id": "diploma", "label": "Diploma"},
    {"id": "transcript_of_records", "label": "Transcript of Records"},
    {"id": "certificate", "label": "Certificate"},
    {"id": "id_card", "label": "ID Card"},
    {"id": "good_moral_certificate", "label": "Good Moral Certificate"},
    {"id": "general_certification", "label": "General Certification"},
    {"id": "enrollment_certificate", "label": "Enrollment Certificate"},
    {"id": "honorable_dismissal", "label": "Honorable Dismissal"},
    {"id": "authentication_letter", "label": "Authentication Letter"},
    {"id": "other", "label": "Other"},
]

DOCUMENT_TYPE_LABELS: dict[str, str] = {
    item["id"]: item["label"] for item in DOCUMENT_TYPE_OPTIONS
}

DOCUMENT_TYPE_ALIASES: dict[str, str] = {
    "diploma": "diploma",
    "transcript": "transcript_of_records",
    "transcript_of_records": "transcript_of_records",
    "tor": "transcript_of_records",
    "certificate": "certificate",
    "id": "id_card",
    "id_card": "id_card",
    "good_moral": "good_moral_certificate",
    "good_moral_certificate": "good_moral_certificate",
    "general_certification": "general_certification",
    "certification": "general_certification",
    "enrollment": "enrollment_certificate",
    "enrollment_certificate": "enrollment_certificate",
    "honorable_dismissal": "honorable_dismissal",
    "authentication_letter": "authentication_letter",
    "other": "other",
}


def _slugify_document_type(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return normalized.strip("_")


def normalize_document_type(value: str) -> str:
    slug = _slugify_document_type(value)
    return DOCUMENT_TYPE_ALIASES.get(slug, slug)


def is_supported_document_type(value: str) -> bool:
    return normalize_document_type(value) in DOCUMENT_TYPE_LABELS


def document_type_label(value: str | None) -> str:
    if not value:
        return "Unknown"
    normalized = normalize_document_type(value)
    return DOCUMENT_TYPE_LABELS.get(normalized, value.replace("_", " ").title())


def equivalent_document_types(value: str | None) -> set[str]:
    if not value:
        return set()
    normalized = normalize_document_type(value)
    related = {
        raw_type
        for raw_type, canonical_type in DOCUMENT_TYPE_ALIASES.items()
        if canonical_type == normalized
    }
    related.add(normalized)
    return related
