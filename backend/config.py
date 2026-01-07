### `backend/config.py`
from pydantic import BaseModel
import os
from pathlib import Path
from dotenv import load_dotenv
 
# Chemin vers le .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./splitapp.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "samir")
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

settings = Settings()

# Centralized Jar Configuration
JAR_CONFIG = {
    "NEC": {"name": "Necessities", "icon": "bi-house-door", "color": "bg-orange", "desc": "Rent, Food, Bills"},
    "FFA": {"name": "Financial Freedom", "icon": "bi-graph-up-arrow", "color": "bg-yellow", "desc": "Investments, Passive Income"},
    "EDU": {"name": "Education", "icon": "bi-book", "color": "bg-grey", "desc": "Books, Courses, Seminars"},
    "LTSS": {"name": "Long Term Savings", "icon": "bi-piggy-bank", "color": "bg-blue", "desc": "Big purchases, Rainy day"},
    "PLAY": {"name": "Play", "icon": "bi-controller", "color": "bg-light-green", "desc": "Fun, Hobbies, Dining out"},
    "GIVE": {"name": "Give", "icon": "bi-heart", "color": "bg-green", "desc": "Charity, Gifts"}
}
