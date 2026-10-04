"""Upload validation: size cap, extension and content-type allowlist, and magic-byte check."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile

from app.config import settings

# kind -> (allowed extensions, allowed declared content types, file signatures, canonical mime)
_KINDS: dict[str, tuple[set[str], set[str], tuple[bytes, ...], str]] = {
    "pdf": ({".pdf"}, {"application/pdf"}, (b"%PDF-",), "application/pdf"),
    "png": ({".png"}, {"image/png"}, (b"\x89PNG\r\n\x1a\n",), "image/png"),
    "jpg": ({".jpg", ".jpeg"}, {"image/jpeg", "image/jpg", "image/pjpeg"}, (b"\xff\xd8\xff",), "image/jpeg"),
}

DOCUMENT_KINDS = ("pdf", "png", "jpg")
IMAGE_KINDS = ("png", "jpg")

# Browsers sometimes send this for any file; the magic-byte check still applies.
_GENERIC_CONTENT_TYPES = {"application/octet-stream", ""}

INLINE_SAFE_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg"}


def _extension(filename: str | None) -> str:
    name = (filename or "").strip().lower()
    dot = name.rfind(".")
    return name[dot:] if dot != -1 else ""


def detect_kind(content: bytes) -> str | None:
    for kind, (_exts, _types, signatures, _mime) in _KINDS.items():
        if any(content.startswith(sig) for sig in signatures):
            return kind
    return None


async def read_limited(file: UploadFile, max_bytes: int | None = None) -> bytes:
    limit = max_bytes or settings.max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail=f"File is too large. The limit is {limit // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def read_validated_upload(file: UploadFile, allowed_kinds: tuple[str, ...] = DOCUMENT_KINDS) -> tuple[bytes, str]:
    """Return (content, canonical mime type) or raise 413/415.

    The extension, the declared content type, and the file's own leading bytes
    must all agree on one allowed kind.
    """
    allowed_names = ", ".join(k.upper() for k in allowed_kinds)
    unsupported = HTTPException(status_code=415, detail=f"Unsupported file type. Upload a {allowed_names} file.")

    ext = _extension(file.filename)
    declared = (file.content_type or "").split(";")[0].strip().lower()
    claimed_kind = next((k for k in allowed_kinds if ext in _KINDS[k][0]), None)
    if claimed_kind is None:
        raise unsupported
    if declared not in _GENERIC_CONTENT_TYPES and declared not in _KINDS[claimed_kind][1]:
        raise unsupported

    content = await read_limited(file)
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if detect_kind(content) != claimed_kind:
        raise unsupported
    return content, _KINDS[claimed_kind][3]


def safe_extension_for_mime(mime: str) -> str:
    return {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}.get(mime, "")
