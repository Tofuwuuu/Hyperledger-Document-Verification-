import os
from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings(BaseSettings):
    """Application settings"""
    # Project metadata
    PROJECT_NAME: str = "CVSU-Carmona Alumni Document Verification System"
    PROJECT_DESCRIPTION: str = "API for CVSU-Carmona Alumni Document Verification System"
    PROJECT_VERSION: str = "1.0.0"
    
    # API settings
    API_PREFIX: str = "/api/v1"

    # Environment / security toggles
    ENV: str = os.getenv("ENV", "development")  # development | production
    ENABLE_CSRF: bool = os.getenv("ENABLE_CSRF", "false").lower() == "true"
    ENABLE_ADMIN_BYPASS: bool = os.getenv("ENABLE_ADMIN_BYPASS", "false").lower() == "true"
    ADMIN_BYPASS_SECRET: str = os.getenv("ADMIN_BYPASS_SECRET", "")
    
    # JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "development_secret_key")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
    
    # CORS settings
    CORS_ORIGINS: Union[List[str], str] = [
        # Local development origins
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # Database settings
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB", "cvsu_alumni")
    
    # WebSocket settings
    WS_CONNECTION_LIFETIME: int = int(os.getenv("WS_CONNECTION_LIFETIME", "3600"))  # 1 hour
    WS_PING_INTERVAL: int = int(os.getenv("WS_PING_INTERVAL", "30"))  # 30 seconds
    
    # Notification settings
    NOTIFICATION_CLEANUP_DAYS: int = int(os.getenv("NOTIFICATION_CLEANUP_DAYS", "30"))  # 30 days
    
    # Blockchain settings
    BLOCKCHAIN_ENABLED: bool = os.getenv("BLOCKCHAIN_ENABLED", "false").lower() == "true"
    FABRIC_GATEWAY_URL: str = os.getenv("FABRIC_GATEWAY_URL", "http://fabric-gateway:3001")
    
    # Email settings
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAILS_FROM_EMAIL: str = os.getenv("EMAILS_FROM_EMAIL", "noreply@cvsu.edu.ph")
    EMAILS_FROM_NAME: str = os.getenv("EMAILS_FROM_NAME", "CVSU Alumni System")
    
    # Features
    WEBSOCKETS_ENABLED: bool = False
    NOTIFICATIONS_ENABLED: bool = True
    
    # Jitsi Meeting Settings
    JITSI_APP_ID: str = os.getenv("JITSI_APP_ID", "alumni_app_id")
    JITSI_APP_SECRET: str = os.getenv("JITSI_APP_SECRET", "default_secret_key")
    JITSI_JWT_ISSUER: str = os.getenv("JITSI_JWT_ISSUER", "alumni_app")
    JITSI_JWT_AUDIENCE: str = os.getenv("JITSI_JWT_AUDIENCE", "jitsi")
    JITSI_JWT_HOURS: int = int(os.getenv("JITSI_JWT_HOURS", "24"))
    
    # Frontend URL for redirects and QR codes
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Configure pydantic-settings v2
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Handle CORS origins from environment variable
    def get_cors_origins(self) -> List[str]:
        """Convert CORS_ORIGINS to a list regardless of input type"""
        if isinstance(self.CORS_ORIGINS, str):
            if self.CORS_ORIGINS == "*":
                # Return all origins for debugging
                return ["*"]
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS

# Create a global settings object
settings = Settings() 