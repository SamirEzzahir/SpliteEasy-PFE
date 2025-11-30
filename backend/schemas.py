from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

# ======================
# FriendStatus Enum
# ======================
class FriendStatus(str, Enum):
    pending = "Pending"
    accepted = "Accepted"
    rejected = "Rejected"


class GlobalSettlementMode(str, Enum):
    separate = "separate"  # Option 1: Keep separate (current behavior)
    auto_adjust = "auto_adjust"  # Option 2: Auto-adjust groups
    hybrid = "hybrid"  # Option 3: Show both original and adjusted

# ======================
# Role Schemas
# ======================
class RoleBase(BaseModel):
    name: str
    permissions: str = "[]"

class RoleCreate(RoleBase):
    pass

class RoleRead(RoleBase):
    id: int
    
    class Config:
        from_attributes = True

# ======================
# Reclamation Schemas
# ======================
class ReclamationBase(BaseModel):
    subject: str
    message: str

class ReclamationCreate(ReclamationBase):
    pass

class ReclamationUpdate(BaseModel):
    status: str

class ReclamationRead(ReclamationBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ======================
# User Schemas
# ======================
class UserBase(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: Optional[bool] = True


    model_config = {
        "from_attributes": True
    }

class UserCreate(UserBase):
    password: str

class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: Optional[bool] = True
    role_id: Optional[int] = None
    role: Optional[RoleRead] = None
    global_settlement_mode: Optional[GlobalSettlementMode] = GlobalSettlementMode.separate


    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None


class ChangePassword(BaseModel):
    old_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ======================
# Group Schemas
# ======================
class GroupBase(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    owner_id: int

# For input
class GroupCreate(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    member_ids: list[int] = []

# For output
class GroupRead(BaseModel):
    id: int
    title: str
    currency: str
    type: str
    photo: Optional[str]
    owner_id: int
    description: str
    owner_username: Optional[str] = None
    members_usernames: list[str] = []
    expenses_count: Optional[int] = 0  # Number of expenses in this group
    has_unsettled_balance: Optional[bool] = False  # Whether group has unsettled balances
    created_at: datetime

    class Config:
        from_attributes = True



# ======================
# Membership Schemas
# ======================
class MembershipBase(BaseModel):
    user_id: int
    group_id: int
    is_admin: Optional[bool] = False
    username: Optional[str] = None

class MembershipCreate(MembershipBase):
    pass

class MembershipUpdate(BaseModel):
    is_admin: bool
    
class MembershipRead(MembershipBase):
    id: int

    class Config:
        from_attributes = True

# ======================
# Splites Schemas
# ======================
class SplitBase(BaseModel):
    user_id: int
    share_amount: float
    username: Optional[str] = None

class SplitCreate(SplitBase):
    pass

class SplitRead(SplitBase):
    id: int
    expense_id: int
    user_id: int
    share_amount: float
    username: Optional[str] = None

    class Config:
        from_attributes = True

 
        
# ======================
# Expense Schemas
# ======================

class ExpenseBase(BaseModel):
    group_id: Optional[int] = None
    payer_id: Optional[int] = None
    added_by: Optional[int] = None
    description: str
    amount: float
    currency: Optional[str] = None  # Will be set from group currency
    category: Optional[str] = None
    wallet_id: Optional[int] = None
    split_type: Optional[str] = "equal"
    note: Optional[str] = None
    photo: Optional[str] = None
   

class ExpenseCreate(ExpenseBase):
    splits: List[SplitCreate] = []
    created_at: datetime

 

class ExpenseRead(BaseModel):
    id: int
    group_id: int
    payer_id: int
    added_by: int
    description: str
    amount: float
    currency: str
    category: str | None = None
    wallet_id: int | None = None
    split_type: str | None = None
    note: str | None = None
    photo: str | None = None
    created_at: datetime
    updated_at: datetime 
    splits: list[SplitRead] = []
    payer_username: str | None = None
    added_by_username: str | None = None
    group_name: str | None = None
    payer_name: str | None = None
    wallet_name: str | None = None

    class Config:
        from_attributes = True

class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    wallet_id: Optional[int] = None
    split_type: Optional[str] = None
    note: Optional[str] = None
    photo: Optional[str] = None
    splits: Optional[List[SplitCreate]] = None


class ExpensePaginatedResponse(BaseModel):
    expenses: List[ExpenseRead]
    total: int
    offset: int
    limit: int
    has_more: bool

# ======================
# Friend Schemas
# ======================
class FriendBase(BaseModel):
    user_id: int
    friend_id: int
    status: FriendStatus = FriendStatus.pending

class FriendCreate(FriendBase):
    pass

class FriendRead(FriendBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ======================
# Balance / Settlement
# ======================
class BalanceItem(BaseModel):
    user_id: int
    username: str
    net: float
    original_net: Optional[float] = None  # For hybrid mode: original balance before global settlements
    global_adjustment: Optional[float] = None  # For hybrid mode: amount adjusted by global settlements

class SettlementStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
 
class SettlementCreate(BaseModel):
    to_user_id: int
    amount: float
    message: Optional[str] = None

class SettlementAction(BaseModel):
    reason: Optional[str] = None

class SettlementOut(BaseModel):
    id: Optional[int] = None
    group_id: int
    from_user_id: int
    from_username: str
    to_user_id: int
    to_username: str
    amount: float
    status: SettlementStatus
    message: Optional[str] = None
    proof_photo: Optional[str] = None
    rejected_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class GlobalSettlementCreate(BaseModel):
    to_user_id: int
    amount: float
    message: Optional[str] = None

class GlobalSettlementOut(BaseModel):
    id: Optional[int] = None
    from_user_id: int
    from_username: str
    to_user_id: int
    to_username: str
    amount: float
    status: SettlementStatus
    message: Optional[str] = None
    proof_photo: Optional[str] = None
    rejected_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None





class ActivityLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    target_type: str | None
    target_id: int | None
    created_at: datetime
    user: UserRead

    class Config:
        from_attributes = True




# ======================
# INCOME SCHEMAS
# ======================
class IncomeTypeBase(BaseModel):
    name: str = Field(..., example="Salary")
    category: Optional[str] = Field(None, example="Work")

class IncomeTypeCreate(IncomeTypeBase):
    pass

class IncomeTypeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None

class IncomeTypeRead(IncomeTypeBase):
    id: int
    user_id: Optional[int] = None

    class Config:
        from_attributes = True

class WalletBase(BaseModel):
    name: str = Field(..., example="Main Wallet")
    category: str = Field("cash", example="bank")  # cash, bank, credit_card, other
    balance: float = Field(0.0, example=500.00)

class WalletCreate(WalletBase):
    pass

class WalletUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    balance: Optional[float] = None

class WalletRead(WalletBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IncomeBase(BaseModel):
    amount: float = Field(..., example=1000.0)
    source_type: Optional[str] = Field("bank", example="cash")
    note: Optional[str] = Field(None, example="October salary")
    date: datetime = datetime.utcnow()

class IncomeCreate(IncomeBase):
    income_type_id: int
    wallet_id: int

class IncomeRead(IncomeBase):
    id: int
    user_id: int
    income_type: IncomeTypeRead
    wallet: WalletRead
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source_type: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None
    income_type_id: Optional[int] = None
    wallet_id: Optional[int] = None

class IncomeReadWithNames(BaseModel):
    id: int
    user_id: int
    amount: float
    date: datetime
    note: str | None
    wallet_id: int
    wallet_name: str
    income_type_id: int
    category_name: str
    created_at: datetime
    updated_at: datetime    


# ======================
# TRANSACTION SCHEMAS
# ======================
class TransactionType(str, Enum):
    transfer = "transfer"
    debt = "debt"
    credit = "credit"

class TransactionBase(BaseModel):
    amount: float
    note: Optional[str] = None
    transaction_type: TransactionType = TransactionType.transfer

class TransactionCreate(TransactionBase):
    from_wallet_id: int
    to_wallet_id: Optional[int] = None  # Nullable for debts

class TransactionRead(TransactionBase):
    id: int
    user_id: int
    created_at: datetime
    from_wallet: WalletRead
    to_wallet: Optional[WalletRead] = None

    class Config:
        from_attributes = True

# ======================
# DEBT & LOAN SCHEMAS
# ======================
class DebtLoanStatus(str, Enum):
    active = "active"
    partially_paid = "partially_paid"
    fully_paid = "fully_paid"

class DebtBase(BaseModel):
    lender_name: str
    original_amount: float
    wallet_id: Optional[int] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None

class DebtCreate(DebtBase):
    pass

class DebtUpdate(BaseModel):
    lender_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None

class DebtRead(DebtBase):
    id: int
    user_id: int
    remaining_amount: float
    status: DebtLoanStatus
    created_at: datetime
    updated_at: datetime
    total_paid: float = 0.0

    class Config:
        from_attributes = True

class LoanBase(BaseModel):
    borrower_name: str
    original_amount: float
    wallet_id: Optional[int] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None

class LoanCreate(LoanBase):
    pass

class LoanUpdate(BaseModel):
    borrower_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None

class LoanRead(LoanBase):
    id: int
    user_id: int
    remaining_amount: float
    status: DebtLoanStatus
    created_at: datetime
    updated_at: datetime
    total_paid: float = 0.0

    class Config:
        from_attributes = True

class DebtRepaymentCreate(BaseModel):
    amount: float
    wallet_id: Optional[int] = None
    note: Optional[str] = None

class DebtRepaymentRead(BaseModel):
    id: int
    debt_id: int
    amount: float
    wallet_id: Optional[int] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LoanRepaymentCreate(BaseModel):
    amount: float
    wallet_id: Optional[int] = None
    note: Optional[str] = None

class LoanRepaymentRead(BaseModel):
    id: int
    loan_id: int
    amount: float
    wallet_id: Optional[int] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True



# ======================
# Jar Strategy Schemas
# ======================
class JarStrategyBase(BaseModel):
    name: str
    nec: float
    ffa: float
    edu: float
    ltss: float
    play: float
    give: float

class JarStrategyCreate(JarStrategyBase):
    pass

class JarStrategyRead(JarStrategyBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ======================
# Jar Transaction Schemas
# ======================
class JarTransactionBase(BaseModel):
    jar_type: str
    amount: float
    description: str
    date: datetime = datetime.utcnow()

class JarTransactionCreate(JarTransactionBase):
    pass

class JarTransactionRead(JarTransactionBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class JarBalance(BaseModel):
    jar_type: str
    balance: float


# ======================
# Income Source Schemas
# ======================
class IncomeSourceBase(BaseModel):
    name: str

class IncomeSourceCreate(IncomeSourceBase):
    pass

class IncomeSourceRead(IncomeSourceBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class MonthlySummary(BaseModel):
    month: str
    NEC: float = 0.0
    FFA: float = 0.0
    EDU: float = 0.0
    LTSS: float = 0.0
    PLAY: float = 0.0
    GIVE: float = 0.0
    total: float = 0.0
