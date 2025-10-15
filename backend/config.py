### `backend/config.py`
from pydantic import BaseModel
import os
from pathlib import Path
from dotenv import load_dotenv

# Chemin vers le .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
print(env_path)
class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./splitapp.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "samir")
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

settings = Settings()
