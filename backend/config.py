from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "remote_secret_key_change_in_production_2024")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "3888"))

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:4888",
        "http://127.0.0.1:4888",
        "http://localhost:3000",
    ]

    # SMTP
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Remote PDF Review")
    SMTP_FROM_ADDRESS: str = os.getenv("SMTP_FROM_ADDRESS", "")

    # Frontend URL
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:4888")

    # Admin defaults
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@remote.local")

    # Paths
    DATA_DIR: str = os.path.join(os.path.dirname(__file__), "data")
    UPLOADS_DIR: str = os.path.join(os.path.dirname(__file__), "uploads")

    # Preflight defaults
    BLEED_TOLERANCE_MM: float = 2.5
    MIN_IMAGE_DPI: int = 149
    MIN_LINE_WIDTH_PT: float = 0.25

    # XMF external service
    XMF_SERVER_URL: str = os.getenv("XMF_SERVER_URL", "https://jdf-maker-back.triky.app")
    XMF_AUTH_URL: str = os.getenv("XMF_AUTH_URL", "https://auth-service.triky.app/token")
    XMF_AUTH_USERNAME: str = os.getenv("XMF_AUTH_USERNAME", "triky007@hotmail.com")
    XMF_AUTH_PASSWORD: str = os.getenv("XMF_AUTH_PASSWORD", "Masketu.123$")
    XMF_TEST_MODE: bool = os.getenv("XMF_TEST_MODE", "true").lower() == "true"

    class Config:
        env_file = ".env"


settings = Settings()
