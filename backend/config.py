import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "landassist-super-secret-key-prod-grade-9847192348")
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "landassist.db"))
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "storage" / "uploads"))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload size
    ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

    # Session cookie hardening
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours

    # AI & OCR configurations
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")

    # CORS configuration for local React development
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    # SMS Gateway & OTP Configurations
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
    SMS_GATEWAY_DEV_MODE = os.getenv("SMS_GATEWAY_DEV_MODE", "true").lower() == "true"

    # Passport photo constraints
    PHOTO_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
    MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB max for passport photographs
