from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve `.env` next to the `backend/` folder, even if the process cwd is the repo root.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]

# Values that must never be accepted as a signing key.
_FORBIDDEN_SECRET_KEYS = {"change_me", "changeme", "secret", "your-secret-key"}
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    # Support both env var names from your existing compose/deployment docs.
    mongodb_url: str | None = None
    mongodb_uri: str | None = None

    # CORS settings
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Signs every access token. Required: there is no default, and the app
    # refuses to start if it is missing, short, or a known placeholder.
    # Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    secret_key: str

    # Access tokens are short-lived. Logout bumps a per-user token version,
    # which ends every token issued before it.
    access_token_minutes: int = 60
    mfa_pending_token_minutes: int = 5
    # /auth/refresh can extend a session, but never past this many hours
    # after the original sign-in.
    session_max_hours: int = 12

    # Comma-separated proxy IPs or CIDRs (for example your host's load balancer)
    # whose X-Forwarded-For header is trusted. Empty means trust no proxy and
    # rate-limit on the direct peer address.
    trusted_proxies: str = ""

    # The demo has no email sending, so password reset is off unless enabled.
    password_reset_enabled: bool = False

    # Upload limits (documents and profile pictures).
    max_upload_bytes: int = 10 * 1024 * 1024

    enable_cors: bool = True

    # Convenience setting (not strictly used in this scaffold)
    env: str = "development"

    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("secret_key")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if cleaned.lower() in _FORBIDDEN_SECRET_KEYS:
            raise ValueError("SECRET_KEY is a placeholder value. Generate a real one.")
        if len(cleaned) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(f"SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters.")
        return cleaned

    @property
    def mongodb_ping_url(self) -> str:
        # Prefer explicit URL, but accept `MONGODB_URI` as a fallback.
        if self.mongodb_url:
            return self.mongodb_url
        if self.mongodb_uri:
            return self.mongodb_uri
        return "mongodb://localhost:27017/cvsu_alumni"

    @property
    def trusted_proxies_list(self) -> list[str]:
        return [item.strip() for item in (self.trusted_proxies or "").split(",") if item.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_origins or ""
        return [item.strip() for item in raw.split(",") if item.strip()]


settings = Settings()
