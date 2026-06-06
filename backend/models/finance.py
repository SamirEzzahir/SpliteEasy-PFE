import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class TransactionType(enum.Enum):
    transfer = "transfer"
    debt = "debt"
    credit = "credit"


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="cash")
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="wallets")
    incomes: Mapped[list["Income"]] = relationship("Income", back_populates="wallet", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="wallet", cascade="all, delete-orphan")
    transactions_from: Mapped[list["Transaction"]] = relationship("Transaction", foreign_keys="Transaction.from_wallet_id", back_populates="from_wallet", cascade="all, delete-orphan")
    transactions_to: Mapped[list["Transaction"]] = relationship("Transaction", foreign_keys="Transaction.to_wallet_id", back_populates="to_wallet", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    to_wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="CASCADE"), nullable=True)
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), default=TransactionType.transfer)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="transactions")
    from_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[from_wallet_id], back_populates="transactions_from")
    to_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[to_wallet_id], back_populates="transactions_to")


class IncomeType(Base):
    __tablename__ = "income_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="income_types")
    incomes: Mapped[list["Income"]] = relationship("Income", back_populates="income_type")


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

    user: Mapped["User"] = relationship("User", back_populates="incomes")
    income_type: Mapped["IncomeType"] = relationship("IncomeType", back_populates="incomes")
    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="incomes")


class IncomeSource(Base):
    __tablename__ = "income_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="income_sources")


class IncomeLog(Base):
    __tablename__ = "income_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    income_source: Mapped[str] = mapped_column(String(100), nullable=False)
    strategy_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="income_logs")
    jar_transactions: Mapped[list["JarTransaction"]] = relationship("JarTransaction", back_populates="income_log", cascade="all, delete-orphan")
