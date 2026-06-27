"""
Document utilities
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path


def calculate_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of document content."""
    return hashlib.sha256(content).hexdigest()


def slugify_filename_part(value: str, *, fallback: str = "file") -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower())
    cleaned = cleaned.strip("-")
    return cleaned or fallback


def owner_folder_name(profile: dict | None, user: dict | None) -> str:
    full_name = (profile or {}).get("full_name") or (user or {}).get("full_name") or ""
    first_name = full_name.split()[0] if full_name else ""
    email = (profile or {}).get("email") or (user or {}).get("email") or ""
    email_local = email.split("@")[0] if email else ""
    return slugify_filename_part(first_name or email_local, fallback="user")


def safe_upload_extension(original_filename: str | None) -> str:
    suffix = Path(original_filename or "").suffix.lower()
    if not suffix:
        return ""
    extension = suffix[1:]
    if not extension.isalnum() or len(extension) > 10:
        return ""
    return suffix


def build_document_upload_paths(
    backend_root: Path,
    *,
    profile: dict | None,
    user: dict | None,
    document_type: str,
    original_filename: str | None,
) -> tuple[Path, str]:
    """Return absolute save path and repo-relative path for an uploaded document."""
    owner_slug = owner_folder_name(profile, user)
    doc_slug = slugify_filename_part(document_type, fallback="document")
    ext = safe_upload_extension(original_filename)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    stem = slugify_filename_part(Path(original_filename or "file").stem, fallback="file")
    filename = f"{timestamp}_{stem}{ext}"

    relative_path = Path("uploads") / owner_slug / doc_slug / filename
    saved_path = backend_root / relative_path
    saved_path.parent.mkdir(parents=True, exist_ok=True)
    return saved_path, relative_path.as_posix()
