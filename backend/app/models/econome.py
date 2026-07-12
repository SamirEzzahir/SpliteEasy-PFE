from datetime import datetime
from typing import Optional
from sqlalchemy import Float, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class JarStrategy(Base):
    __tablename__ = "jar_strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    nec: Mapped[float] = mapped_column(Float, default=0.0)
    ffa: Mapped[float] = mapped_column(Float, default=0.0)
    edu: Mapped[float] = mapped_column(Float, default=0.0)
    ltss: Mapped[float] = mapped_column(Float, default=0.0)
    play: Mapped[float] = mapped_column(Float, default=0.0)
    give: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship("User")


class JarTransaction(Base):
    __tablename__ = "jar_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    income_log_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("income_logs.id", ondelete="CASCADE"), nullable=True)
    jar_type: Mapped[str] = mapped_column(String(10))
    amount: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(String(255))
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="jar_transactions")
    income_log: Mapped[Optional["IncomeLog"]] = relationship("IncomeLog", back_populates="jar_transactions")
