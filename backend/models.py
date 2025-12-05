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


class TransactionType(enum.Enum):
    transfer = "transfer"  # Transfer between wallets
    debt = "debt"  # Money borrowed from someone (increases wallet balance)
    credit = "credit"  # Money lent/given to someone (decreases wallet balance)


class DebtLoanStatus(enum.Enum):
    active = "active"
    partially_paid = "partially_paid"
    fully_paid = "fully_paid"
 
# ======================
# Role (RBAC)
# ======================
class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    permissions: Mapped[str] = mapped_column(String(5000), default="[]") # JSON string of permissions

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


# ======================
# Reclamation (Support Tickets)
# ======================
class ReclamationStatus(enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    resolved = "resolved"
    rejected = "rejected"

class Reclamation(Base):
    __tablename__ = "reclamations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    status: Mapped[ReclamationStatus] = mapped_column(Enum(ReclamationStatus), default=ReclamationStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="reclamations")


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
    
    # RBAC: Replaces is_admin
    role_id: Mapped[int | None] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    
    global_settlement_mode: Mapped[GlobalSettlementMode] = mapped_column(
        Enum(GlobalSettlementMode), 
        default=GlobalSettlementMode.separate
    )
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
    income_types: Mapped[list["IncomeType"]] = relationship("IncomeType", back_populates="user",cascade="all, delete-orphan")
    wallets: Mapped[list["Wallet"]] = relationship("Wallet",back_populates="user",cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    jar_strategies: Mapped[list["JarStrategy"]] = relationship("JarStrategy", back_populates="user", cascade="all, delete-orphan")
    jar_transactions: Mapped[list["JarTransaction"]] = relationship("JarTransaction", back_populates="user", cascade="all, delete-orphan")
    income_sources: Mapped[list["IncomeSource"]] = relationship("IncomeSource", back_populates="user", cascade="all, delete-orphan")
    debts: Mapped[list["Debt"]] = relationship("Debt", back_populates="user", cascade="all, delete-orphan")
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    reclamations: Mapped[list["Reclamation"]] = relationship("Reclamation", back_populates="user", cascade="all, delete-orphan")
    income_logs: Mapped[list["IncomeLog"]] = relationship("IncomeLog", back_populates="user", cascade="all, delete-orphan")

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
# JarTransaction
# ======================
class JarTransaction(Base):
    __tablename__ = "jar_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    income_log_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("income_logs.id", ondelete="CASCADE"), nullable=True)
    jar_type: Mapped[str] = mapped_column(String(10))  # NEC, FFA, EDU, LTSS, PLAY, GIVE
    amount: Mapped[float] = mapped_column(Float)  # Positive for income, Negative for expense
    description: Mapped[str] = mapped_column(String(255))
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="jar_transactions")
    income_log: Mapped[Optional["IncomeLog"]] = relationship("IncomeLog", back_populates="jar_transactions")


# ======================
# IncomeSource
# ======================
class IncomeSource(Base):
    __tablename__ = "income_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="income_sources")



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
    to_wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="CASCADE"), nullable=True)  # Nullable for debts
    
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), default=TransactionType.transfer)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    from_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[from_wallet_id], back_populates="transactions_from")
    to_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[to_wallet_id], back_populates="transactions_to")


# ======================
# Debt (Money you owe)
# ======================
class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lender_name: Mapped[str] = mapped_column(String(200), nullable=False)  # Who you borrowed from
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[DebtLoanStatus] = mapped_column(Enum(DebtLoanStatus), default=DebtLoanStatus.active)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)  # Wallet where money was added
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="debts")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])
    repayments: Mapped[list["DebtRepayment"]] = relationship("DebtRepayment", back_populates="debt", cascade="all, delete-orphan")


# ======================
# Loan (Money others owe you)
# ======================
class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    borrower_name: Mapped[str] = mapped_column(String(200), nullable=False)  # Who you lent to
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[DebtLoanStatus] = mapped_column(Enum(DebtLoanStatus), default=DebtLoanStatus.active)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)  # Wallet where money was taken from
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="loans")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])
    repayments: Mapped[list["LoanRepayment"]] = relationship("LoanRepayment", back_populates="loan", cascade="all, delete-orphan")


# ======================
# Debt Repayment (Paying back a debt)
# ======================
class DebtRepayment(Base):
    __tablename__ = "debt_repayments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    debt_id: Mapped[int] = mapped_column(ForeignKey("debts.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)  # Wallet where money was taken from
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    debt: Mapped["Debt"] = relationship("Debt", back_populates="repayments")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])


# ======================
# Loan Repayment (Receiving back a loan)
# ======================
class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id", ondelete="SET NULL"), nullable=True)  # Wallet where money was added
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    loan: Mapped["Loan"] = relationship("Loan", back_populates="repayments")
    wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[wallet_id])


# ======================
# Jar Strategy (Money Jars)
# ======================
class JarStrategy(Base):
    __tablename__ = "jar_strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    # If user_id is None, it's a global/default strategy

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Percentages (stored as decimals, e.g., 0.55 for 55%)
    nec: Mapped[float] = mapped_column(Float, default=0.0)
    ffa: Mapped[float] = mapped_column(Float, default=0.0)
    edu: Mapped[float] = mapped_column(Float, default=0.0)
    ltss: Mapped[float] = mapped_column(Float, default=0.0)
    play: Mapped[float] = mapped_column(Float, default=0.0)
    give: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship("User")


# ======================
# Income Log (For Ledger)
# ======================
class IncomeLog(Base):
    __tablename__ = "income_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    income_source: Mapped[str] = mapped_column(String(100), nullable=False) # Store name directly for simplicity
    strategy_name: Mapped[str] = mapped_column(String(100), nullable=False) # Store name directly
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="income_logs")
    jar_transactions: Mapped[list["JarTransaction"]] = relationship("JarTransaction", back_populates="income_log", cascade="all, delete-orphan")



