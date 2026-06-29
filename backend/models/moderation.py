from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ModerationReport(Base):
    """A user-submitted report about content or another user."""

    __tablename__ = "moderation_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(20))  # user | group | expense | message
    target_id: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(20))  # spam | abuse | fake_account | inappropriate | other
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open")  # open | reviewing | dismissed | actioned
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    handled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id])
    handler: Mapped["User"] = relationship("User", foreign_keys=[handled_by])
