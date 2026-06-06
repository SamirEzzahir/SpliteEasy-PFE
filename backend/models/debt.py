import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class DebtLoanStatus(enum.Enum):
    active = "active"
    partially_paid = "partially_paid"
    fully_paid = "fully_paid"


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lender_name: Mapped[str] = mapped_column(String(200), nullable=False)
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[DebtLoanStatus] = mapped_column(Enum(DebtLoanStatus), default=DebtLoanStatus.active)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="debts")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])
    repayments: Mapped[list["DebtRepayment"]] = relationship("DebtRepayment", back_populates="debt", cascade="all, delete-orphan")


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    borrower_name: Mapped[str] = mapped_column(String(200), nullable=False)
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[DebtLoanStatus] = mapped_column(Enum(DebtLoanStatus), default=DebtLoanStatus.active)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="loans")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])
    repayments: Mapped[list["LoanRepayment"]] = relationship("LoanRepayment", back_populates="loan", cascade="all, delete-orphan")


class DebtRepayment(Base):
    __tablename__ = "debt_repayments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    debt_id: Mapped[int] = mapped_column(ForeignKey("debts.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    debt: Mapped["Debt"] = relationship("Debt", back_populates="repayments")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="repayments")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])
