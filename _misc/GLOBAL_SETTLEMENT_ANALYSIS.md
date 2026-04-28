# Global Settlement System - Deep Analysis & Implementation Plan

## 📋 Executive Summary

This document provides a comprehensive analysis of your SplitEasy project and explains how to implement a **global settlement system** that allows users to settle debts across ALL groups between friends, not just within individual groups.

---

## 🔍 Current System Architecture

### 1. **Data Models**

#### Current Settlement Model (`backend/models.py`)
```python
class Settlement(Base):
    id: int
    group_id: int          # ⚠️ Currently scoped to a single group
    from_user_id: int
    to_user_id: int
    amount: float
    created_at: datetime
```

**Key Limitation**: Settlements are **group-scoped**. Each settlement is tied to a specific `group_id`, meaning:
- Settlements in Group A don't affect balances in Group B
- You can't net out debts across different groups
- Each group maintains its own isolated settlement history

#### Friend Model
```python
class Friend(Base):
    user_id: int
    friend_id: int
    status: FriendStatus  # pending, accepted, rejected
```

**Current State**: Friendships exist but are **not connected** to settlements or balances.

### 2. **Balance Calculation System**

#### Current Implementation (`backend/crud.py::compute_group_balances`)
- **Scope**: Single group only
- **Process**:
  1. Calculates credits (what each user paid) per group
  2. Calculates debits (what each user owes via splits) per group
  3. Applies settlements **only within that group**
  4. Returns net balance per user **for that group only**

**Formula**: `Balance = (Total Paid) - (Total Owed) + (Settlements Received) - (Settlements Paid)`

### 3. **Settlement Flow**

#### Current Endpoints (`backend/routers/settle.py`)
- `GET /settle/{group_id}/balances` - Get balances for a specific group
- `GET /settle/{group_id}/settlements` - Get suggested settlements for a group
- `GET /settle/{group_id}/history` - Get settlement history for a group
- `POST /settle/{group_id}/record` - Record a settlement in a group

**All endpoints require a `group_id`** - there's no global settlement endpoint.

### 4. **Frontend Implementation**

#### Current UI (`frontend/js/balance.js`)
- Displays balances **per group** (requires `?id=group_id` in URL)
- Settlement modal only shows users from the **current group**
- No way to view or settle debts across multiple groups

---

## 🎯 What "Global Settlement" Means

### The Problem
**Current Scenario:**
- User A and User B are friends
- In Group 1: User A owes User B $50
- In Group 2: User B owes User A $30
- **Current system**: They need to settle separately in each group
- **Desired system**: They should be able to net these out globally ($50 - $30 = $20 from A to B)

### The Solution
A **global settlement system** that:
1. **Aggregates balances** across all groups between friends
2. **Calculates net balances** per friend relationship (not per group)
3. **Suggests optimal settlements** that minimize transactions globally
4. **Allows recording settlements** that apply globally (or optionally per group)

---

## 🏗️ Implementation Strategy

### **Option 1: Global Settlement Table (Recommended)**

Create a new settlement type that works across groups:

#### Database Changes

**1. Modify Settlement Model** (Add `is_global` flag)
```python
class Settlement(Base):
    id: int
    group_id: int | None      # ⚠️ Make nullable for global settlements
    from_user_id: int
    to_user_id: int
    amount: float
    is_global: bool = False   # NEW: True = global, False = group-specific
    created_at: datetime
```

**2. Alternative: Separate Global Settlement Table**
```python
class GlobalSettlement(Base):
    __tablename__ = "global_settlements"
    
    id: int
    from_user_id: int
    to_user_id: int
    amount: float
    created_at: datetime
    # No group_id - applies globally
```

#### New Functions Needed

**1. Compute Global Balances** (`backend/crud.py`)
```python
async def compute_global_balances(
    session: AsyncSession, 
    user_id: int
) -> dict[int, float]:
    """
    Calculate net balances between current user and all their friends
    across ALL groups.
    
    Returns: {friend_id: net_balance}
    - Positive = friend owes you
    - Negative = you owe friend
    """
    # 1. Get all accepted friends
    friends = await get_accepted_friends(session, user_id)
    
    # 2. For each friend, aggregate balances from all shared groups
    global_balances = {}
    for friend in friends:
        friend_id = friend.friend_id if friend.user_id == user_id else friend.user_id
        
        # Get all groups where both users are members
        shared_groups = await get_shared_groups(session, user_id, friend_id)
        
        # Aggregate balances from all shared groups
        total_balance = Decimal("0.00")
        for group_id in shared_groups:
            group_balances = await compute_group_balances(session, group_id)
            user_balance = group_balances.get(user_id, 0)
            friend_balance = group_balances.get(friend_id, 0)
            
            # Net balance with this friend in this group
            # If user has +50 and friend has -50, user is owed 50
            # If user has -30 and friend has +30, user owes 30
            net_with_friend = (user_balance - friend_balance) / 2
            total_balance += net_with_friend
        
        # Apply global settlements
        global_settlements = await get_global_settlements(session, user_id, friend_id)
        for settlement in global_settlements:
            if settlement.from_user_id == user_id:
                total_balance += settlement.amount  # You paid them
            else:
                total_balance -= settlement.amount  # They paid you
        
        global_balances[friend_id] = float(total_balance)
    
    return global_balances
```

**2. Get Shared Groups** (`backend/crud.py`)
```python
async def get_shared_groups(
    session: AsyncSession,
    user1_id: int,
    user2_id: int
) -> list[int]:
    """Get all group IDs where both users are members"""
    result = await session.execute(
        select(Membership.group_id)
        .join(
            select(Membership.group_id)
            .where(Membership.user_id == user2_id)
            .subquery(),
            Membership.group_id == subquery.c.group_id
        )
        .where(Membership.user_id == user1_id)
    )
    return [row[0] for row in result.all()]
```

**3. Minimize Global Cash Flow** (`backend/debt.py`)
```python
def minimize_global_cash_flow(
    global_balances: dict[int, float]
) -> list[dict]:
    """
    Same algorithm as minimize_cash_flow, but works on global balances
    between friends instead of group members.
    """
    # Reuse existing minimize_cash_flow function
    return minimize_cash_flow(global_balances)
```

#### New API Endpoints

**1. Global Balances** (`backend/routers/settle.py`)
```python
@router.get("/global/balances", response_model=list[BalanceItem])
async def global_balances(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get global balances between current user and all their friends
    across all groups.
    """
    balances = await compute_global_balances(session, current.id)
    
    # Fetch friend usernames
    friend_ids = list(balances.keys())
    result = await session.execute(
        select(User.id, User.username).where(User.id.in_(friend_ids))
    )
    users = dict(result.all())
    
    return [
        BalanceItem(
            user_id=friend_id,
            username=users.get(friend_id, f"User {friend_id}"),
            net=balance
        )
        for friend_id, balance in balances.items()
    ]
```

**2. Global Settlements** (`backend/routers/settle.py`)
```python
@router.get("/global/settlements", response_model=list[SettlementOut])
async def global_settlements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get suggested global settlements between current user and friends.
    """
    balances = await compute_global_balances(session, current.id)
    settlements = minimize_global_cash_flow(balances)
    
    # Format and return
    # ... (similar to group settlements)
```

**3. Record Global Settlement** (`backend/routers/settle.py`)
```python
@router.post("/global/record", response_model=SettlementOut)
async def record_global_settlement(
    payload: SettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Record a global settlement (applies across all groups).
    """
    # Verify friendship
    await ensure_friendship(session, current.id, payload.to_user_id)
    
    # Create global settlement (group_id = None or is_global = True)
    settlement = GlobalSettlement(
        from_user_id=current.id,
        to_user_id=payload.to_user_id,
        amount=payload.amount,
        created_at=datetime.utcnow()
    )
    
    session.add(settlement)
    await session.commit()
    
    # Return formatted response
    # ...
```

**4. Global Settlement History** (`backend/routers/settle.py`)
```python
@router.get("/global/history", response_model=list[SettlementOut])
async def global_settlement_history(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get global settlement history for current user.
    """
    result = await session.execute(
        select(GlobalSettlement)
        .where(
            (GlobalSettlement.from_user_id == current.id) |
            (GlobalSettlement.to_user_id == current.id)
        )
        .order_by(GlobalSettlement.created_at.desc())
    )
    # Format and return
    # ...
```

#### Frontend Changes

**1. New Global Settlement Page** (`frontend/global-settle.html`)
- Similar to `balances.html` but shows balances across all groups
- Displays friend-by-friend balances
- Allows recording global settlements

**2. Update Navigation** (`frontend/js/navbar.js`)
- Add link to "Global Settlements" page

**3. Global Balance Component** (`frontend/js/global-balance.js`)
- Similar to `balance.js` but calls `/settle/global/*` endpoints
- Shows aggregated balances per friend

---

### **Option 2: Hybrid Approach (Group + Global)**

Allow users to choose between:
- **Group Settlement**: Applies only to a specific group (current behavior)
- **Global Settlement**: Applies across all groups (new feature)

**UI Enhancement**: Add a toggle/checkbox when recording settlements:
- "Apply to this group only" (default)
- "Apply globally to all groups"

---

## 📊 Data Flow Diagram

### Current Flow (Group-Scoped)
```
User A & B in Group 1
  └─> Expenses → Group 1 Balances
  └─> Settlement → Group 1 Settlement (affects only Group 1)

User A & B in Group 2
  └─> Expenses → Group 2 Balances
  └─> Settlement → Group 2 Settlement (affects only Group 2)
```

### Proposed Flow (Global)
```
User A & B (Friends)
  └─> Group 1 Expenses → Group 1 Balance: A owes B $50
  └─> Group 2 Expenses → Group 2 Balance: B owes A $30
  └─> Global Balance Calculation → Net: A owes B $20
  └─> Global Settlement → Record $20 payment (affects both groups)
```

---

## 🔧 Implementation Steps (When Ready)

### Phase 1: Database & Models
1. ✅ Add `GlobalSettlement` model OR modify `Settlement` to support `is_global`
2. ✅ Create database migration
3. ✅ Update schemas (`schemas.py`)

### Phase 2: Backend Logic
1. ✅ Implement `compute_global_balances()`
2. ✅ Implement `get_shared_groups()`
3. ✅ Implement `ensure_friendship()` helper
4. ✅ Create global settlement endpoints
5. ✅ Update `minimize_cash_flow()` to work with global balances

### Phase 3: Frontend
1. ✅ Create `global-settle.html` page
2. ✅ Create `global-balance.js` script
3. ✅ Update navigation
4. ✅ Add global settlement UI components

### Phase 4: Testing
1. ✅ Test global balance calculation
2. ✅ Test global settlement recording
3. ✅ Test that group balances still work correctly
4. ✅ Test edge cases (no shared groups, no friends, etc.)

---

## ⚠️ Important Considerations

### 1. **Currency Handling**
- **Current**: Each group has its own currency
- **Challenge**: What if Group 1 uses USD and Group 2 uses EUR?
- **Solution**: 
  - Option A: Only allow global settlements between groups with same currency
  - Option B: Convert currencies using exchange rates
  - Option C: Show separate balances per currency

### 2. **Settlement Priority**
- **Question**: If a global settlement is recorded, how does it affect group balances?
- **Solution**: 
  - Global settlements should reduce balances in ALL shared groups proportionally
  - OR: Global settlements are tracked separately and only affect the "global view"

### 3. **Backward Compatibility**
- **Current**: All existing settlements are group-scoped
- **Solution**: 
  - Keep existing `Settlement` model for group settlements
  - Add new `GlobalSettlement` model for global settlements
  - OR: Add `is_global` flag and set existing records to `False`

### 4. **User Experience**
- **Question**: Should users see both group and global balances?
- **Solution**: 
  - Show group balances on group pages (current behavior)
  - Show global balances on a new "Global Settlements" page
  - Allow users to choose which type of settlement to record

### 5. **Performance**
- **Concern**: Computing global balances requires aggregating data from multiple groups
- **Solution**: 
  - Cache global balances
  - Use database indexes on `Membership` and `Settlement` tables
  - Consider pagination for users with many friends/groups

---

## 📝 Summary

### What You Have Now
- ✅ Group-scoped settlements
- ✅ Balance calculation per group
- ✅ Settlement history per group
- ✅ Friend relationships (but not connected to settlements)

### What You Need
- ✅ Global balance aggregation across groups
- ✅ Global settlement recording
- ✅ Friend-based settlement view
- ✅ UI to view and manage global settlements

### Recommended Approach
**Use Option 1 (Global Settlement Table)** because:
- ✅ Cleaner separation of concerns
- ✅ Easier to query and maintain
- ✅ Doesn't break existing group settlement logic
- ✅ Can coexist with group settlements

---

## 🚀 Next Steps

When you're ready to implement:

1. **Review this document** and confirm the approach
2. **Decide on currency handling** strategy
3. **Choose between** separate table vs. flag approach
4. **Tell me to proceed** and I'll implement it step by step

---

## 📞 Questions to Consider

Before implementation, please think about:

1. **Should global settlements affect group balances?**
   - Yes: A global settlement reduces balances in all shared groups
   - No: Global settlements are separate and only shown in global view

2. **What about currency differences?**
   - Only allow global settlements between same-currency groups?
   - Or convert currencies?

3. **Should users see both views?**
   - Group view (current) + Global view (new)?
   - Or replace group view with global view?

4. **Settlement priority?**
   - Can users record both group and global settlements?
   - Or should global settlements replace group settlements?

---

**Ready to implement?** Just say "go ahead" or "implement it" and I'll start with Phase 1! 🚀

