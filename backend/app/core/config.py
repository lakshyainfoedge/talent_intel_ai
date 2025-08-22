from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "Talent Intel AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # MongoDB Configuration
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "talent_intel_db")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # AI Platform
    GOOGLE_CLOUD_PROJECT: Optional[str] = os.getenv("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_REGION: Optional[str] = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
    
    class Config:
        case_sensitive = True

settings = Settings()
