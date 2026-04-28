# Settlement Approval/Rejection System - Implementation Plan

## 📋 Overview

This document outlines the implementation of a **settlement approval system** where settlements require confirmation from the receiving user before being marked as completed.

---

## 🎯 Requirements

### Current Flow (Before)
1. User A records settlement with User B
2. Settlement immediately marked as "completed"
3. Added to history

### New Flow (After)
1. User A records settlement with User B
2. Settlement created with **"pending"** status
3. User B receives notification
4. User B can:
   - **Accept** → Status becomes "accepted" (completed)
   - **Reject** → Status becomes "rejected"
5. If rejected:
   - Appears in history with "rejected" status
   - User A can see it and:
     - **Resend/Reopen** the settlement
     - Add a message (optional)
     - Add proof photo later (receipt, invoice, etc.)
6. User B can see pending/rejected settlements in their transaction history
7. User B can accept/reject again based on real situation

---

## 🏗️ Implementation Plan

### **Phase 1: Database & Models**

#### 1.1 Add Status Enum to Settlement Model

**File**: `backend/models.py`

```python
class SettlementStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"

class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus), 
        default=SettlementStatus.pending  # ✅ NEW: Default to pending
    )
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)  # ✅ NEW: Optional message
    proof_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)  # ✅ NEW: Optional proof photo
    rejected_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)  # ✅ NEW: Why it was rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # ✅ NEW: Track updates

    from_user: Mapped["User"] = relationship("User", foreign_keys=[from_user_id])
    to_user: Mapped["User"] = relationship("User", foreign_keys=[to_user_id])
```

**Migration Strategy**:
- Existing settlements: Set `status = "accepted"` (assume they were already completed)
- Add `updated_at = created_at` for existing records

#### 1.2 Update Schemas

**File**: `backend/schemas.py`

```python
class SettlementStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"

class SettlementCreate(BaseModel):
    to_user_id: int
    amount: float
    message: Optional[str] = None  # ✅ NEW: Optional message when creating

class SettlementOut(BaseModel):
    id: Optional[int] = None
    from_user_id: int
    from_username: str
    to_user_id: int
    to_username: str
    amount: float
    status: SettlementStatus  # ✅ NEW: Include status
    message: Optional[str] = None  # ✅ NEW
    proof_photo: Optional[str] = None  # ✅ NEW
    rejected_reason: Optional[str] = None  # ✅ NEW
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None  # ✅ NEW

class SettlementAction(BaseModel):  # ✅ NEW: For accept/reject actions
    reason: Optional[str] = None  # Optional reason for rejection
```

---

### **Phase 2: Backend Logic**

#### 2.1 Modify Settlement Recording

**File**: `backend/routers/settle.py`

**Current**: Settlement created and immediately committed
**New**: Settlement created with `status="pending"` and notification sent

```python
@router.post("/{group_id}/record", response_model=SettlementOut, status_code=status.HTTP_201_CREATED)
async def record_settlement(
    group_id: int,
    payload: SettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    # ... existing validation ...
    
    # Create settlement with PENDING status
    settlement = Settlement(
        group_id=group_id,
        from_user_id=current.id,
        to_user_id=payload.to_user_id,
        amount=float(amount),
        status=SettlementStatus.pending,  # ✅ NEW: Start as pending
        message=payload.message,  # ✅ NEW: Store optional message
        created_at=datetime.utcnow()
    )
    
    session.add(settlement)
    await session.commit()
    await session.refresh(settlement)
    
    # ✅ NEW: Send notification to User B
    from backend.routers.notifications import send_notification
    notification_msg = (
        f"{from_username} recorded a settlement of {amount} {group_currency}. "
        f"Please review and confirm."
    )
    await send_notification(
        payload.to_user_id,
        notification_msg
    )
    
    # ✅ NEW: Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"requested settlement with {to_username} for {amount} {group_currency}",
        target_type="settlement",
        target_id=settlement.id
    )
    
    return SettlementOut(
        id=settlement.id,
        from_user_id=current.id,
        from_username=from_username,
        to_user_id=payload.to_user_id,
        to_username=to_username,
        amount=payload.amount,
        status=SettlementStatus.pending,  # ✅ NEW
        message=settlement.message,  # ✅ NEW
        created_at=settlement.created_at
    )
```

#### 2.2 Add Accept Settlement Endpoint

**File**: `backend/routers/settle.py`

```python
@router.post("/{settlement_id}/accept", response_model=SettlementOut)
async def accept_settlement(
    settlement_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User B accepts a pending settlement from User A.
    """
    # Fetch settlement
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    # Verify current user is the recipient (to_user_id)
    if settlement.to_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the recipient can accept this settlement"
        )
    
    # Verify status is pending
    if settlement.status != SettlementStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Settlement is already {settlement.status.value}"
        )
    
    # Update status
    settlement.status = SettlementStatus.accepted
    settlement.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(settlement)
    
    # ✅ Send notification to User A
    from_user = await session.get(User, settlement.from_user_id)
    await send_notification(
        settlement.from_user_id,
        f"{current.username} accepted your settlement of {settlement.amount}"
    )
    
    # ✅ Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"accepted settlement from {from_user.username}",
        target_type="settlement",
        target_id=settlement.id
    )
    
    # Fetch usernames and return
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return SettlementOut(
        id=settlement.id,
        from_user_id=settlement.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=settlement.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=settlement.amount,
        status=settlement.status,
        message=settlement.message,
        proof_photo=settlement.proof_photo,
        created_at=settlement.created_at,
        updated_at=settlement.updated_at
    )
```

#### 2.3 Add Reject Settlement Endpoint

**File**: `backend/routers/settle.py`

```python
@router.post("/{settlement_id}/reject", response_model=SettlementOut)
async def reject_settlement(
    settlement_id: int,
    payload: SettlementAction,  # Contains optional reason
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User B rejects a pending settlement from User A.
    """
    # Fetch settlement
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    # Verify current user is the recipient
    if settlement.to_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the recipient can reject this settlement"
        )
    
    # Verify status is pending
    if settlement.status != SettlementStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Settlement is already {settlement.status.value}"
        )
    
    # Update status
    settlement.status = SettlementStatus.rejected
    settlement.rejected_reason = payload.reason  # ✅ Store rejection reason
    settlement.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(settlement)
    
    # ✅ Send notification to User A
    from_user = await session.get(User, settlement.from_user_id)
    reason_text = f" Reason: {payload.reason}" if payload.reason else ""
    await send_notification(
        settlement.from_user_id,
        f"{current.username} rejected your settlement of {settlement.amount}.{reason_text}"
    )
    
    # ✅ Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"rejected settlement from {from_user.username}",
        target_type="settlement",
        target_id=settlement.id
    )
    
    # Fetch usernames and return
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return SettlementOut(
        id=settlement.id,
        from_user_id=settlement.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=settlement.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=settlement.amount,
        status=settlement.status,
        message=settlement.message,
        rejected_reason=settlement.rejected_reason,
        created_at=settlement.created_at,
        updated_at=settlement.updated_at
    )
```

#### 2.4 Add Resend/Reopen Settlement Endpoint

**File**: `backend/routers/settle.py`

```python
@router.post("/{settlement_id}/resend", response_model=SettlementOut)
async def resend_settlement(
    settlement_id: int,
    payload: SettlementCreate,  # Can update amount/message
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User A resends/reopens a rejected settlement.
    Creates a new pending settlement or updates the existing one.
    """
    # Fetch original settlement
    original = await session.get(Settlement, settlement_id)
    if not original:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    # Verify current user is the sender
    if original.from_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the sender can resend this settlement"
        )
    
    # Verify original was rejected
    if original.status != SettlementStatus.rejected:
        raise HTTPException(
            status_code=400,
            detail="Can only resend rejected settlements"
        )
    
    # Option 1: Update existing settlement (recommended)
    original.status = SettlementStatus.pending
    original.amount = payload.amount  # Allow updating amount
    original.message = payload.message  # Update message
    original.rejected_reason = None  # Clear rejection reason
    original.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(original)
    
    # ✅ Send notification to User B
    to_user = await session.get(User, original.to_user_id)
    await send_notification(
        original.to_user_id,
        f"{current.username} resent the settlement request for {original.amount}"
    )
    
    # ✅ Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"resent settlement to {to_user.username}",
        target_type="settlement",
        target_id=original.id
    )
    
    # Fetch usernames and return
    from_user = await session.get(User, original.from_user_id)
    to_user = await session.get(User, original.to_user_id)
    
    return SettlementOut(
        id=original.id,
        from_user_id=original.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=original.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=original.amount,
        status=original.status,
        message=original.message,
        created_at=original.created_at,
        updated_at=original.updated_at
    )
```

#### 2.5 Update Settlement History

**File**: `backend/routers/settle.py`

```python
@router.get("/{group_id}/history", response_model=list[SettlementOut])
async def settlement_history(
    group_id: int,
    status: Optional[SettlementStatus] = None,  # ✅ NEW: Filter by status
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await ensure_user_in_group(session, current.id, group_id)
    
    # Build query
    query = select(Settlement).where(
        (Settlement.group_id == group_id) &
        (
            (Settlement.from_user_id == current.id) |
            (Settlement.to_user_id == current.id)
        )
    )
    
    # ✅ NEW: Filter by status if provided
    if status:
        query = query.where(Settlement.status == status)
    
    query = query.order_by(Settlement.created_at.desc())
    
    result = await session.execute(query)
    settlements = result.scalars().all()
    
    # Fetch usernames
    user_ids = {s.from_user_id for s in settlements} | {s.to_user_id for s in settlements}
    if not user_ids:
        return []
    
    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())
    
    # Format output with status
    return [
        SettlementOut(
            id=s.id,
            from_user_id=s.from_user_id,
            from_username=users.get(s.from_user_id, "Unknown"),
            to_user_id=s.to_user_id,
            to_username=users.get(s.to_user_id, "Unknown"),
            amount=s.amount,
            status=s.status,  # ✅ NEW: Include status
            message=s.message,  # ✅ NEW
            proof_photo=s.proof_photo,  # ✅ NEW
            rejected_reason=s.rejected_reason,  # ✅ NEW
            created_at=s.created_at,
            updated_at=s.updated_at  # ✅ NEW
        )
        for s in settlements
    ]
```

#### 2.6 Add Get Pending Settlements Endpoint

**File**: `backend/routers/settle.py`

```python
@router.get("/pending", response_model=list[SettlementOut])
async def get_pending_settlements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get all pending settlements where current user is the recipient (needs to accept/reject).
    """
    result = await session.execute(
        select(Settlement)
        .where(
            (Settlement.to_user_id == current.id) &
            (Settlement.status == SettlementStatus.pending)
        )
        .order_by(Settlement.created_at.desc())
    )
    
    settlements = result.scalars().all()
    
    # Fetch usernames
    user_ids = {s.from_user_id for s in settlements}
    if not user_ids:
        return []
    
    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())
    
    # Fetch group info
    group_ids = {s.group_id for s in settlements}
    res_groups = await session.execute(
        select(Group.id, Group.title).where(Group.id.in_(group_ids))
    )
    groups = dict(res_groups.all())
    
    return [
        SettlementOut(
            id=s.id,
            from_user_id=s.from_user_id,
            from_username=users.get(s.from_user_id, "Unknown"),
            to_user_id=s.to_user_id,
            to_username=current.username,
            amount=s.amount,
            status=s.status,
            message=s.message,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in settlements
    ]
```

#### 2.7 Update Balance Calculation

**File**: `backend/crud.py`

**Important**: Only count **accepted** settlements in balance calculations!

```python
async def compute_group_balances(session: AsyncSession, group_id: int) -> dict[int, float]:
    # ... existing code for credits and debits ...
    
    # ✅ MODIFY: Only apply ACCEPTED settlements
    settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(
            (Settlement.group_id == group_id) &
            (Settlement.status == SettlementStatus.accepted)  # ✅ NEW: Only accepted
        )
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )
    
    # ... rest of the function stays the same ...
```

---

### **Phase 3: Frontend Changes**

#### 3.1 Update Settlement History Display

**File**: `frontend/js/balance.js`

```javascript
// Update loadHistory() function to show status
async function loadHistory() {
    // ... existing code ...
    
    data.forEach((settlement) => {
        // ✅ NEW: Show status badge
        const statusBadge = getStatusBadge(settlement.status);
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${settlement.from_username}</td>
            <td>${settlement.to_username}</td>
            <td>${formatCurrency(settlement.amount)} MAD</td>
            <td>${statusBadge}</td>  // ✅ NEW: Status badge
            <td>${getRelativeTime(settlement.created_at)}</td>
            <td>
                ${settlement.status === 'rejected' && settlement.from_user_id === currentUser.id 
                    ? `<button class="btn btn-sm btn-outline-primary" onclick="resendSettlement(${settlement.id})">
                         <i class="bi bi-arrow-repeat me-1"></i>Resend
                       </button>`
                    : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge bg-warning">Pending</span>',
        'accepted': '<span class="badge bg-success">Accepted</span>',
        'rejected': '<span class="badge bg-danger">Rejected</span>'
    };
    return badges[status] || '';
}
```

#### 3.2 Add Pending Settlements Page/Component

**File**: `frontend/pending-settlements.html` (new)

```html
<!-- Show all pending settlements where user needs to accept/reject -->
<div class="container">
    <h2>Pending Settlements</h2>
    <div id="pendingSettlementsList"></div>
</div>
```

**File**: `frontend/js/pending-settlements.js` (new)

```javascript
async function loadPendingSettlements() {
    const res = await fetch(`${API_URL}/settle/pending`, {
        headers: getHeaders()
    });
    
    const settlements = await res.json();
    
    settlements.forEach(settlement => {
        // Show settlement card with Accept/Reject buttons
        // ...
    });
}

async function acceptSettlement(settlementId) {
    const res = await fetch(`${API_URL}/settle/${settlementId}/accept`, {
        method: 'POST',
        headers: getHeaders()
    });
    
    if (res.ok) {
        showSuccess("Settlement accepted!");
        loadPendingSettlements();
    }
}

async function rejectSettlement(settlementId, reason) {
    const res = await fetch(`${API_URL}/settle/${settlementId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: reason })
    });
    
    if (res.ok) {
        showSuccess("Settlement rejected");
        loadPendingSettlements();
    }
}
```

#### 3.3 Update Settlement Modal

**File**: `frontend/js/balance.js`

Add message field to settlement form:

```javascript
// In openSettlementModal() or settlement form
const messageInput = document.createElement("textarea");
messageInput.id = "settlementMessage";
messageInput.placeholder = "Optional message or note...";
messageInput.className = "form-control";
// Add to form
```

#### 3.4 Add Resend Functionality

**File**: `frontend/js/balance.js`

```javascript
async function resendSettlement(settlementId) {
    // Show modal to update amount/message
    // Then call resend endpoint
    const res = await fetch(`${API_URL}/settle/${settlementId}/resend`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            to_user_id: /* get from settlement */,
            amount: /* updated amount */,
            message: /* updated message */
        })
    });
    
    if (res.ok) {
        showSuccess("Settlement resent!");
        loadHistory();
    }
}
```

---

### **Phase 4: Future Enhancements (Optional)**

#### 4.1 Add Proof Photo Upload

**File**: `backend/routers/settle.py`

```python
@router.post("/{settlement_id}/upload-proof")
async def upload_proof(
    settlement_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User A uploads proof (receipt, invoice, etc.) for a settlement.
    """
    # Verify ownership
    settlement = await session.get(Settlement, settlement_id)
    if settlement.from_user_id != current.id:
        raise HTTPException(status_code=403)
    
    # Save file and update settlement.proof_photo
    # ... file upload logic ...
    
    settlement.proof_photo = file_path
    await session.commit()
    
    return {"message": "Proof uploaded successfully"}
```

---

## 📊 Status Flow Diagram

```
User A records settlement
    ↓
Status: PENDING
    ↓
User B receives notification
    ↓
    ├─→ User B ACCEPTS
    │       ↓
    │   Status: ACCEPTED
    │       ↓
    │   Counted in balances
    │
    └─→ User B REJECTS
            ↓
        Status: REJECTED
            ↓
        User A sees rejection
            ↓
        User A can RESEND
            ↓
        Status: PENDING (again)
            ↓
        (Cycle repeats)
```

---

## ✅ Implementation Checklist

### Database & Models
- [ ] Add `SettlementStatus` enum to `models.py`
- [ ] Add `status` field to `Settlement` model (default: pending)
- [ ] Add `message` field to `Settlement` model
- [ ] Add `proof_photo` field to `Settlement` model
- [ ] Add `rejected_reason` field to `Settlement` model
- [ ] Add `updated_at` field to `Settlement` model
- [ ] Update `SettlementOut` schema with new fields
- [ ] Add `SettlementAction` schema
- [ ] Update `SettlementCreate` schema with message field

### Backend Endpoints
- [ ] Modify `record_settlement` to create with pending status
- [ ] Add notification when settlement is created
- [ ] Create `accept_settlement` endpoint
- [ ] Create `reject_settlement` endpoint
- [ ] Create `resend_settlement` endpoint
- [ ] Update `settlement_history` to include status
- [ ] Update `settlement_history` to filter by status
- [ ] Create `get_pending_settlements` endpoint
- [ ] Update `compute_group_balances` to only count accepted settlements

### Frontend
- [ ] Update history display to show status badges
- [ ] Add pending settlements page/component
- [ ] Add Accept/Reject buttons
- [ ] Add message field to settlement form
- [ ] Add resend functionality for rejected settlements
- [ ] Update navigation to show pending count
- [ ] Add notification handling for settlement requests

### Testing
- [ ] Test settlement creation (should be pending)
- [ ] Test acceptance flow
- [ ] Test rejection flow
- [ ] Test resend flow
- [ ] Test balance calculation (only accepted)
- [ ] Test notifications
- [ ] Test edge cases (double accept, etc.)

---

## 🎯 Summary

This system adds a **confirmation layer** to settlements:
- ✅ Settlements require approval before being counted
- ✅ Users can reject with reason
- ✅ Rejected settlements can be resent
- ✅ Clear status tracking (pending/accepted/rejected)
- ✅ Future-proof for proof photos

**Ready to implement?** Just say "implement settlement approval" and I'll start! 🚀

