from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve `.env` next to the `backend/` folder, even if the process cwd is the repo root.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    # Support both env var names from your existing compose/deployment docs.
    mongodb_url: str | None = None
    mongodb_uri: str | None = None

    # CORS settings
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # Used later for JWT/auth; included now so the service starts cleanly.
    secret_key: str = "change_me"

    enable_cors: bool = True

    # Convenience setting (not strictly used in this scaffold)
    env: str = "development"

    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def mongodb_ping_url(self) -> str:
        # Prefer explicit URL, but accept `MONGODB_URI` as a fallback.
        if self.mongodb_url:
            return self.mongodb_url
        if self.mongodb_uri:
            return self.mongodb_uri
        return "mongodb://localhost:27017/cvsu_alumni"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_origins or ""
        return [item.strip() for item in raw.split(",") if item.strip()]


settings = Settings()
