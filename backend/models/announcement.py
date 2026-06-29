from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Announcement(Base):
    """A platform announcement (maintenance / release / feature / security / emergency)."""

    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20), default="feature")  # maintenance|release|feature|security|emergency
    visibility: Mapped[str] = mapped_column(String(20), default="everyone")  # everyone | admins | role:<id>
    delivery: Mapped[str] = mapped_column(String(20), default="banner")  # notification | banner | popup
    publish_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    notified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author: Mapped["User"] = relationship("User", foreign_keys=[created_by])
