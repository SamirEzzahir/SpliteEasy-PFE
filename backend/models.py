import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import Float, String, Integer, ForeignKey, DateTime, Numeric, Boolean, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
 


class FriendStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class SettlementStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class GlobalSettlementMode(enum.Enum):
    separate = "separate"  # Option 1: Keep separate (current behavior)
    auto_adjust = "auto_adjust"  # Option 2: Auto-adjust groups
    hybrid = "hybrid"  # Option 3: Show both original and adjusted


class GenderEnum(enum.Enum):
    male = "Male"
    female = "Female"

# ======================
# User
# ======================
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
    gender: Mapped[GenderEnum | None] = mapped_column(Enum(GenderEnum), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    global_settlement_mode: Mapped[GlobalSettlementMode] = mapped_column(
        Enum(GlobalSettlementMode), 
        default=GlobalSettlementMode.separate
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="user", cascade="all, delete-orphan")
    expenses_paid: Mapped[list["Expense"]] = relationship("Expense", back_populates="payer", foreign_keys="Expense.payer_id")
    expenses_added: Mapped[list["Expense"]] = relationship("Expense", back_populates="added_by_user", foreign_keys="Expense.added_by")
    splits: Mapped[list["Split"]] = relationship("Split", back_populates="user", cascade="all, delete-orphan")
    owned_groups: Mapped[list["Group"]] = relationship("Group", back_populates="owner")
    friends: Mapped[list["Friend"]] = relationship("Friend", foreign_keys="Friend.user_id", back_populates="user", cascade="all, delete-orphan")
    friend_of: Mapped[list["Friend"]] = relationship("Friend", foreign_keys="Friend.friend_id", back_populates="friend", cascade="all, delete-orphan")
    
    incomes: Mapped[list["Income"]] = relationship(back_populates="user")
    income_types: Mapped[list["IncomeType"]] = relationship("IncomeType", back_populates="user",cascade="all, delete-orphan")
    wallets: Mapped[list["Wallet"]] = relationship("Wallet",back_populates="user",cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

# ======================
# Group
# ======================
class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(200), default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50), default="Other")
    photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="owned_groups")
    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="group", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="group", cascade="all, delete-orphan")


# ======================
# Membership
# ======================
class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "group_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="memberships")
    group: Mapped["Group"] = relationship("Group", back_populates="memberships")


# ======================
# Expense
# ======================
class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    payer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    added_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Numeric(12,2))
    currency: Mapped[str] = mapped_column(String(10))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id"), nullable=True)
    split_type: Mapped[str] = mapped_column(String(20), default="equal")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group: Mapped["Group"] = relationship("Group", back_populates="expenses")
    payer: Mapped[Optional["User"]] = relationship("User", back_populates="expenses_paid", foreign_keys=[payer_id])
    added_by_user: Mapped["User"] = relationship("User", back_populates="expenses_added", foreign_keys=[added_by])
    splits: Mapped[list["Split"]] = relationship("Split", back_populates="expense", cascade="all, delete-orphan")
    wallet: Mapped[Optional["Wallet"]] = relationship("Wallet", back_populates="expenses")

# ======================
# Split
# ======================
class Split(Base):
    __tablename__ = "splits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    expense_id: Mapped[int] = mapped_column(ForeignKey("expenses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    share_amount: Mapped[float] = mapped_column(Numeric(12,2))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    expense: Mapped["Expense"] = relationship("Expense", back_populates="splits")
    user: Mapped["User"] = relationship("User", back_populates="splits")


# ======================
# Friend
# ======================
class Friend(Base):
    __tablename__ = "friends"
    __table_args__ = (UniqueConstraint("user_id","friend_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    friend_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[FriendStatus] = mapped_column(Enum(FriendStatus), default=FriendStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="friends")
    friend: Mapped["User"] = relationship("User", foreign_keys=[friend_id], back_populates="friend_of")



# ======================
# Settlement
# ======================
class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[SettlementStatus] = mapped_column(Enum(SettlementStatus), default=SettlementStatus.pending)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proof_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rejected_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    from_user: Mapped["User"] = relationship("User", foreign_keys=[from_user_id])
    to_user: Mapped["User"] = relationship("User", foreign_keys=[to_user_id])


# ======================
# Global Settlement
# ======================
class GlobalSettlement(Base):
    __tablename__ = "global_settlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[SettlementStatus] = mapped_column(Enum(SettlementStatus), default=SettlementStatus.pending)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proof_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rejected_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    from_user: Mapped["User"] = relationship("User", foreign_keys=[from_user_id])
    to_user: Mapped["User"] = relationship("User", foreign_keys=[to_user_id])


# ======================
# Activité
# ======================
class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String(255), nullable=False)       # <-- add length
    target_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")



# ======================
# Income
# ======================
class Income(Base):
    __tablename__ = "incomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    income_type_id: Mapped[int] = mapped_column(ForeignKey("income_types.id"), nullable=False)
    wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id"), nullable=False)

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    source_type: Mapped[str] = mapped_column(String(10), default="bank")
    note: Mapped[Optional[str]] = mapped_column(String(255))
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="incomes")
    income_type: Mapped["IncomeType"] = relationship("IncomeType", back_populates="incomes")
    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="incomes")
    


# ======================
# IncomeType
# ======================
class IncomeType(Base):
    __tablename__ = "income_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. Salary, Gift, Freelance
    category: Mapped[Optional[str]] = mapped_column(String(50))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
        # if user_id is null → global (shared)
        # if user_id is set → custom type created by that user

    user: Mapped[Optional["User"]] = relationship("User", back_populates="income_types")
    incomes: Mapped[list["Income"]] = relationship("Income", back_populates="income_type")

# ======================
# Wallet
# ======================
class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="cash")  # cash, bank, credit_card, other
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="wallets")
    incomes: Mapped[list["Income"]] = relationship("Income", back_populates="wallet", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="wallet", cascade="all, delete-orphan")
    transactions_from: Mapped[list["Transaction"]] = relationship("Transaction", foreign_keys="Transaction.from_wallet_id", back_populates="from_wallet", cascade="all, delete-orphan")
    transactions_to: Mapped[list["Transaction"]] = relationship("Transaction", foreign_keys="Transaction.to_wallet_id", back_populates="to_wallet", cascade="all, delete-orphan")


# ======================
# Transaction (Wallet Transfers)
# ======================
class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    to_wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    from_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[from_wallet_id], back_populates="transactions_from")
    to_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[to_wallet_id], back_populates="transactions_to")

