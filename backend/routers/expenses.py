from datetime import datetime
import io
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.db import get_session
from backend import schemas, crud
from backend.models import Expense, Group, Membership, Split, User
from backend.auth import get_current_user
from backend.debt import minimize_cash_flow
from backend.crud import (
    get_expense_ById, 
    get_expenses_for_group,
    ensure_user_in_group,
    add_expense, 
    get_user_by_username, 
    log_activity,
    update_expense, 
    update_wallet_balance,
    round_amount
)
from decimal import Decimal

router = APIRouter(prefix="/expenses")

@router.post("", response_model=schemas.ExpenseRead)
async def create_expense_ep(payload: schemas.ExpenseCreate, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if not payload.payer_id:
        payload.payer_id = current.id
    if not payload.added_by:
        payload.added_by = current.id
    exp = await add_expense(session, payload, [(s.user_id, s.share_amount) for s in payload.splits], current.id)
    return schemas.ExpenseRead.model_validate(exp)


# ✅ Always define static paths first
@router.get("/all", response_model=list[schemas.ExpenseRead])
async def get_all_user_expenses(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    # Get all expenses from groups where the user is a member
    result = await session.execute(
        select(Expense)
        .join(Group)
        .join(Membership, Membership.group_id == Group.id)
        .where(Membership.user_id == current.id)
        .options(
            selectinload(Expense.group),
            selectinload(Expense.added_by_user),
            selectinload(Expense.payer),
            selectinload(Expense.splits).selectinload(Split.user)
        )
        .order_by(Expense.created_at.desc())
    )
    expenses = result.scalars().all()

    # Convert to ExpenseRead with additional fields
    expense_list = []
    for expense in expenses:
        expense_data = schemas.ExpenseRead.model_validate(expense)
        # Add group name
        expense_data.group_name = expense.group.title if expense.group else "Unknown Group"
        # Add payer name
        expense_data.payer_name = expense.payer.username if expense.payer else "Unknown"
        # Add added by name
        expense_data.added_by_username = expense.added_by_user.username if expense.added_by_user else "Unknown"
        expense_list.append(expense_data)

    return expense_list






@router.get("/{group_id}", response_model=list[schemas.ExpenseRead])
async def get_group_expenses(group_id: int, session: AsyncSession = Depends(get_session),current: User = Depends(get_current_user)):
    # ✅ Check membership
    await ensure_user_in_group(session, current.id, group_id)
    return await get_expenses_for_group(session, group_id, current)





@router.get("/exp/{expense_id}", response_model=schemas.ExpenseRead)
async def get_expense(expense_id: int,
                      session: AsyncSession = Depends(get_session),
                      current: User = Depends(get_current_user)):
    return await get_expense_ById(session, expense_id, current)




# ✅ Update Expense
@router.put("/{expense_id}", response_model=schemas.ExpenseRead)
async def update_expense_ep(
    expense_id: int,
    payload: schemas.ExpenseUpdate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return await update_expense(session, expense_id, payload, current)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: int, 
    session: AsyncSession = Depends(get_session), 
    current: User = Depends(get_current_user)
):
    # Fetch the expense with the group and splits eagerly loaded
    result = await session.execute(
        select(Expense)
        .where(Expense.id == expense_id)
        .options(
            selectinload(Expense.group),
            selectinload(Expense.splits)
        )
    )
    expense = result.scalars().first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check if user is the payer OR the group owner (admin)
    is_payer = expense.payer_id == current.id
    is_group_owner = expense.group and expense.group.owner_id == current.id
    
    if not is_payer and not is_group_owner:
        raise HTTPException(status_code=403, detail="Not allowed to delete. Only the payer or group owner can delete expenses.")

    # ✅ REFUND WALLET: Before deleting, refund the TOTAL expense amount to the wallet
    # Only refund if the payer is deleting (group owner deleting doesn't affect wallet)
    if expense.wallet_id and expense.payer_id == current.id:
        # Refund the TOTAL expense amount (not just payer's share)
        total_amount = round_amount(Decimal(str(expense.amount)))
        
        # Refund the amount back to the wallet (positive amount = refund)
        try:
            await update_wallet_balance(
                session,
                expense.wallet_id,
                total_amount,  # Positive amount = refund/add back the TOTAL
                current.id
            )
        except HTTPException as e:
            # If wallet refund fails, we should still log the attempt
            # But we'll let the error propagate so the deletion doesn't happen
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Failed to refund wallet: {e.detail}"
            )

    # Log the deletion
    await log_activity(
        session,
        user_id=current.id,
        action=f"deleted '{expense.description}' in '{expense.group.title}'",
        target_type="expense",
        target_id=expense.id
    )

    # Delete the expense (splits will be deleted via cascade)
    await session.delete(expense)
    await session.commit()



#--------------------------------



@router.get("/{group_id}/download-template")
async def download_expenses_template(
    group_id: int, 
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    # Get group members
    result = await session.execute(
        select(User)
        .join(Membership)
        .where(Membership.group_id == group_id)
    )
    members = result.scalars().all()  # list of User objects



    # Columns: Name, Paid, Payer, Added At, Category, Note, member1, member2, ...
    columns = ["Name", "Paid", "Payer", "Added At", "Category", "Note"] + [m.username for m in members]
    
    # Create a sample row to ensure the file has structure
    from datetime import datetime as dt
    sample_data = {
        "Name": "Example Expense",
        "Paid": 0.00,
        "Payer": members[0].username if members else "",
        "Added At": dt.now().strftime("%Y-%m-%d %H:%M"),
        "Category": "Food",  # Optional - can be left empty
        "Note": ""  # Optional - can be left empty
    }
    # Add member columns with False values
    for member in members:
        sample_data[member.username] = "FALSE"
    
    df = pd.DataFrame([sample_data], columns=columns)

    # Save to bytes buffer
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=group_{group_id}_template.xlsx"})







def parse_date(date_str):
    """Parse date string from Excel to datetime object"""
    # print(f"🕐 Parsing date: {date_str} (type: {type(date_str)})")
    
    if not date_str or pd.isna(date_str):
        print("⚠️ Date is empty or NaN, using current time")
        return datetime.utcnow()
    
    try:
        # Handle pandas Timestamp objects from Excel
        if isinstance(date_str, pd.Timestamp):
            # print(f"✅ Date is pandas Timestamp: {date_str}, converting to datetime")
            return date_str.to_pydatetime()
        
        # If already a datetime, return it
        if isinstance(date_str, datetime):
            # print(f"✅ Date is already datetime: {date_str}")
            return date_str
        
        # Try different date formats for string dates
        date_formats = [
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y"
        ]
        
        date_str_clean = str(date_str).strip()
        # print(f"🕐 Trying to parse as string: '{date_str_clean}'")
        
        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str_clean, fmt)
                # print(f"✅ Successfully parsed date: {parsed} using format: {fmt}")
                return parsed
            except ValueError:
                continue
        
        # If all formats fail, return current time
        print(f"⚠️ Could not parse date '{date_str}', using current time")
        return datetime.utcnow()
    except Exception as e:
        print(f"❌ Error parsing date '{date_str}': {e}, using current time")
        return datetime.utcnow()

@router.post("/{group_id}/upload")
async def upload_expenses(
    group_id: int, 
    file: UploadFile = File(...), 
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    try:
        # Check user is member of group
        await ensure_user_in_group(session, current.id, group_id)
        
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Debug: Print column names and first few rows
        print(f"📊 Excel Columns: {list(df.columns)}")
        if len(df) > 0:
            print(f"📊 First row: {df.iloc[0].to_dict()}")
        else:
            print("📊 Empty file")
            return {"status": "error", "message": "Excel file is empty", "errors": [], "added_count": 0}
    except Exception as e:
        print(f"❌ Error reading Excel file: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Error reading Excel file: {str(e)}", "errors": [], "added_count": 0}

    added_count = 0
    errors = []
    
    # iterate rows
    for idx, row in df.iterrows():
        try:
            # Get payer
            payer_username = str(row["Payer"]).strip()
            payer = await get_user_by_username(session, payer_username)
            
            if not payer:
                errors.append(f"Row {idx+2}: Payer '{payer_username}' not found")
                continue
            
            # Parse amount - handle numeric or string with currency symbols
            amount_value = row["Paid"]
            if pd.isna(amount_value):
                errors.append(f"Row {idx+2}: Amount is empty")
                continue
            
            # Convert to float, handling strings
            try:
                amount = float(str(amount_value).replace(',', '.'))
            except ValueError:
                errors.append(f"Row {idx+2}: Invalid amount '{amount_value}'")
                continue
            
            if amount <= 0:
                errors.append(f"Row {idx+2}: Amount must be greater than 0")
                continue
            
            # Create expense with error handling
            try:
                # Debug: Log the "Added At" value
                added_at_value = row.get("Added At")
                # print(f"📅 Row {idx+2} - Added At value from Excel: {added_at_value}")
                # print(f"📅 Row {idx+2} - Added At value type: {type(added_at_value)}")
                # print(f"📅 Row {idx+2} - pd.isna check: {pd.isna(added_at_value)}")
                
                expense = Expense(
                    group_id=group_id,
                    payer_id=payer.id,
                    added_by=current.id,
                    description=str(row["Name"]).strip(),
                    amount=amount,
                    currency="MAD",
                    category=str(row.get("Category", "")).strip() if pd.notna(row.get("Category")) and str(row.get("Category")).strip() else None,
                    note=str(row.get("Note", "")).strip() if pd.notna(row.get("Note")) and str(row.get("Note")).strip() else None,
                    created_at=parse_date(added_at_value)
                )
                
                session.add(expense)
                await session.flush()  # get expense.id
            except Exception as exp_err:
                errors.append(f"Row {idx+2}: Failed to create expense - {str(exp_err)}")
                continue

            # Get participant columns (skip ID, Name, Paid, Payer, Added At, Category, Note columns)
            participant_cols = [col for col in df.columns if col not in ["ID", "Name", "Paid", "Payer", "Added At", "Category", "Note", "Cost Distribution", "Settled", "Created At"]]
            
            # Count participants who should split
            participants = []
            for participant in participant_cols:
                if participant in row.index and pd.notna(row[participant]) and str(row[participant]).upper() in ["TRUE", "1", "YES", "X", "✓"]:
                    participants.append(participant)
            
            if participants:
                # Get user IDs for all participants
                share = expense.amount / len(participants)
                
                for participant_username in participants:
                    user_obj = await get_user_by_username(session, participant_username)
                    if user_obj:
                        session.add(Split(
                            expense_id=expense.id, 
                            user_id=user_obj.id, 
                            share_amount=share
                        ))
                        added_count += 1
            else:
                errors.append(f"Row {idx+2}: No participants selected")
        except Exception as e:
            errors.append(f"Row {idx+2}: {str(e)}")
            continue
    
    if errors:
        await session.rollback()
        return {
            "status": "error", 
            "message": f"Upload completed with {len(errors)} errors",
            "errors": errors,
            "added_count": added_count
        }
    
    await session.commit()
    return {"status": "success", "message": f"Successfully uploaded {added_count} expenses"}


@router.get("/{group_id}/download")
async def download_expenses(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    # Check user is member of group
    await ensure_user_in_group(session, current.id, group_id)
    # 1) Query expenses with splits and split.user eagerly loaded
    stmt = (
        select(Expense)
        .where(Expense.group_id == group_id)
        .options(
            selectinload(Expense.splits).selectinload(Split.user)
        )
    )
    result = await session.execute(stmt)
    expenses = result.scalars().all()

    # 👉 get all participants of the group via Membership
    participants_res = await session.execute(
        select(User.username)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.group_id == group_id)
    )
    all_participants = [p for (p,) in participants_res.all()]

    # 2) Build rows
    rows = []
    for e in expenses:
        payer_username = None
        if e.payer_id:
            payer_res = await session.execute(select(User.username).where(User.id == e.payer_id))
            payer_username = payer_res.scalar_one_or_none() or f"User {e.payer_id}"

        expense_participants = {s.user.username for s in e.splits if s.user}
        category = getattr(e, "category", "") or ""
        note = getattr(e, "note", "") or ""

        base = {
            "ID": e.id,
            "Name": e.description,
            "Paid": float(e.amount),  # Just the number, no currency symbol
            "Payer": payer_username or "",
            "Category": category,
            "Note": note
        }

        # dynamic participant columns
        for p in all_participants:
            base[p] = "TRUE" if p in expense_participants else "FALSE"

        rows.append(base)

    # 3) DataFrame
    df = pd.DataFrame(
        rows,
        columns=[
            "ID", "Name", "Paid", "Payer", "Category", "Note", *all_participants
        ]
    )

    buffer = io.BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    filename = f"group_{group_id}_expenses.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


