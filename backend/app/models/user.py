import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class GenderEnum(enum.Enum):
    male = "Male"
    female = "Female"


class GlobalSettlementMode(enum.Enum):
    separate = "separate"
    auto_adjust = "auto_adjust"
    hybrid = "hybrid"


class ReclamationStatus(enum.Enum):
    open = "open"
    in_progress = "in_progress"
    waiting_user = "waiting_user"
    resolved = "resolved"
    closed = "closed"


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    permissions: Mapped[str] = mapped_column(String(5000), default="[]")

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gender: Mapped[GenderEnum | None] = mapped_column(Enum(GenderEnum, native_enum=False), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Admin lifecycle state. is_active is kept in sync (active -> True, else False)
    # for backward compatibility with code that still checks is_active.
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    status_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Bumped to invalidate all of a user's outstanding JWTs ("force logout").
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    role_id: Mapped[int | None] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    global_settlement_mode: Mapped[GlobalSettlementMode] = mapped_column(
        Enum(GlobalSettlementMode, native_enum=False), default=GlobalSettlementMode.separate
    )
    preferred_currency: Mapped[str] = mapped_column(String(3), default="USD")
    # First-time onboarding guide: false until the user completes/skips it.
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="user", cascade="all, delete-orphan")
    expenses_paid: Mapped[list["Expense"]] = relationship("Expense", back_populates="payer", foreign_keys="Expense.payer_id")
    expenses_added: Mapped[list["Expense"]] = relationship("Expense", back_populates="added_by_user", foreign_keys="Expense.added_by")
    splits: Mapped[list["Split"]] = relationship("Split", back_populates="user", cascade="all, delete-orphan")
    owned_groups: Mapped[list["Group"]] = relationship("Group", back_populates="owner")
    friends: Mapped[list["Friend"]] = relationship("Friend", foreign_keys="Friend.user_id", back_populates="user", cascade="all, delete-orphan")
    friend_of: Mapped[list["Friend"]] = relationship("Friend", foreign_keys="Friend.friend_id", back_populates="friend", cascade="all, delete-orphan")
    incomes: Mapped[list["Income"]] = relationship(back_populates="user")
    income_types: Mapped[list["IncomeType"]] = relationship("IncomeType", back_populates="user", cascade="all, delete-orphan")
    wallets: Mapped[list["Wallet"]] = relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    jar_strategies: Mapped[list["JarStrategy"]] = relationship("JarStrategy", back_populates="user", cascade="all, delete-orphan")
    jar_transactions: Mapped[list["JarTransaction"]] = relationship("JarTransaction", back_populates="user", cascade="all, delete-orphan")
    income_sources: Mapped[list["IncomeSource"]] = relationship("IncomeSource", back_populates="user", cascade="all, delete-orphan")
    debts: Mapped[list["Debt"]] = relationship("Debt", back_populates="user", cascade="all, delete-orphan")
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    reclamations: Mapped[list["Reclamation"]] = relationship("Reclamation", foreign_keys="Reclamation.user_id", back_populates="user", cascade="all, delete-orphan")
    income_logs: Mapped[list["IncomeLog"]] = relationship("IncomeLog", back_populates="user", cascade="all, delete-orphan")


class Reclamation(Base):
    """A support ticket. (Table kept as ``reclamations`` for backward compatibility;
    surfaced as a "ticket" throughout the API/UI.)"""
    __tablename__ = "reclamations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="other", server_default="other")
    priority: Mapped[str] = mapped_column(String(10), default="medium", server_default="medium")
    status: Mapped[ReclamationStatus] = mapped_column(Enum(ReclamationStatus, native_enum=False), default=ReclamationStatus.open)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="reclamations")
    assignee: Mapped["User"] = relationship("User", foreign_keys=[assigned_to_id])
    replies: Mapped[list["TicketReply"]] = relationship(
        "TicketReply", back_populates="ticket", cascade="all, delete-orphan",
        order_by="TicketReply.created_at",
    )


class TicketReply(Base):
    """A single message in a support ticket thread (from the user or an admin)."""
    __tablename__ = "ticket_replies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reclamation_id: Mapped[int] = mapped_column(ForeignKey("reclamations.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket: Mapped["Reclamation"] = relationship("Reclamation", back_populates="replies")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])
