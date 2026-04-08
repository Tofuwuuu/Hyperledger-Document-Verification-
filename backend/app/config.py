from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Support both env var names from your existing compose/deployment docs.
    mongodb_url: str | None = None
    mongodb_uri: str | None = None

    # CORS settings
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Used later for JWT/auth; included now so the service starts cleanly.
    secret_key: str = "change_me"

    enable_cors: bool = True

    # Convenience setting (not strictly used in this scaffold)
    env: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

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
