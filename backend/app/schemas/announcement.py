from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

ANNOUNCEMENT_TYPES = {"maintenance", "release", "feature", "security", "emergency"}
ANNOUNCEMENT_DELIVERIES = {"notification", "banner", "popup"}


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    type: str = "feature"
    visibility: str = "everyone"  # everyone | admins | role:<id>
    delivery: str = "banner"
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    publish_now: bool = True

    @field_validator("type")
    @classmethod
    def _t(cls, v: str) -> str:
        return v if v in ANNOUNCEMENT_TYPES else "feature"

    @field_validator("delivery")
    @classmethod
    def _d(cls, v: str) -> str:
        return v if v in ANNOUNCEMENT_DELIVERIES else "banner"


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    type: Optional[str] = None
    visibility: Optional[str] = None
    delivery: Optional[str] = None
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_published: Optional[bool] = None


class AnnouncementRead(BaseModel):
    id: int
    title: str
    body: str
    type: str
    visibility: str
    delivery: str
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_published: bool
    created_by: Optional[int] = None
    author_username: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ActiveAnnouncement(BaseModel):
    """Public shape shown to end users (banner/popup)."""
    id: int
    title: str
    body: str
    type: str
    delivery: str
