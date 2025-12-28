from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from .. import models, schemas
from ..dependencies import get_db, get_current_user
from ..config import JAR_CONFIG

router = APIRouter(
    prefix="/econome",
    tags=["econome"],
    responses={404: {"description": "Not found"}},
)

# ======================
# Strategy Endpoints
# ======================

@router.get("/config")
async def get_econome_config(current_user: models.User = Depends(get_current_user)):
    """
    Get the centralized configuration for Jars (colors, icons, descriptions).
    """
    return JAR_CONFIG

@router.get("/strategies", response_model=List[schemas.JarStrategyRead])
async def get_strategies(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all strategies available to the user:
    1. Default global strategies (user_id is NULL)
    2. Custom strategies created by the user
    """
    # Get global strategies
    result_global = await db.execute(select(models.JarStrategy).where(models.JarStrategy.user_id == None))
    global_strategies = result_global.scalars().all()
    
    # Get user strategies
    result_user = await db.execute(select(models.JarStrategy).where(models.JarStrategy.user_id == current_user.id))
    user_strategies = result_user.scalars().all()
    
    return list(global_strategies) + list(user_strategies)

@router.post("/strategies", response_model=schemas.JarStrategyRead)
async def create_strategy(
    strategy: schemas.JarStrategyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new custom strategy for the current user.
    """
    # Validate percentages sum to 1.0 (allow small float error)
    total = strategy.nec + strategy.ffa + strategy.edu + strategy.ltss + strategy.play + strategy.give
    if not (0.99 <= total <= 1.01):
        raise HTTPException(status_code=400, detail="Percentages must sum to 100%")

    db_strategy = models.JarStrategy(
        **strategy.model_dump(),
        user_id=current_user.id
    )
    db.add(db_strategy)
    await db.commit()
    await db.refresh(db_strategy)
    return db_strategy

@router.put("/strategies/{strategy_id}", response_model=schemas.JarStrategyRead)
async def update_strategy(
    strategy_id: int,
    strategy_update: schemas.JarStrategyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update a custom strategy. Users can only update their own strategies.
    """
    result = await db.execute(select(models.JarStrategy).where(
        models.JarStrategy.id == strategy_id,
        models.JarStrategy.user_id == current_user.id
    ))
    db_strategy = result.scalar_one_or_none()

    if not db_strategy:
        raise HTTPException(status_code=404, detail="Strategy not found or not owned by user")

    # Validate percentages
    total = strategy_update.nec + strategy_update.ffa + strategy_update.edu + strategy_update.ltss + strategy_update.play + strategy_update.give
    if not (0.99 <= total <= 1.01):
        raise HTTPException(status_code=400, detail="Percentages must sum to 100%")

    for key, value in strategy_update.model_dump().items():
        setattr(db_strategy, key, value)

    await db.commit()
    await db.refresh(db_strategy)
    return db_strategy

@router.delete("/strategies/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Delete a custom strategy. Users can only delete their own strategies.
    """
    result = await db.execute(select(models.JarStrategy).where(
        models.JarStrategy.id == strategy_id,
        models.JarStrategy.user_id == current_user.id
    ))
    db_strategy = result.scalar_one_or_none()

    if not db_strategy:
        raise HTTPException(status_code=404, detail="Strategy not found or not owned by user")

    await db.delete(db_strategy)
    await db.commit()
    return None

# ======================
# Ledger Endpoints
# ======================

@router.get("/ledger", response_model=List[schemas.LedgerItem])
async def get_ledger(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get unified ledger:
    - Income Logs (full income events)
    - Expenses (negative jar transactions)
    """
    # 1. Fetch Income Logs
    result_income = await db.execute(
        select(models.IncomeLog)
        .where(models.IncomeLog.user_id == current_user.id)
        .order_by(models.IncomeLog.date.desc())
    )
    income_logs = result_income.scalars().all()

    # 2. Fetch Expenses (JarTransactions where amount < 0)
    result_expenses = await db.execute(
        select(models.JarTransaction)
        .where(
            models.JarTransaction.user_id == current_user.id,
            models.JarTransaction.amount < 0
        )
        .order_by(models.JarTransaction.date.desc())
    )
    expenses = result_expenses.scalars().all()

    # 3. Combine and Sort
    ledger_items = []

    for log in income_logs:
        ledger_items.append(schemas.LedgerItem(
            id=log.id,
            type="income",
            amount=log.amount,
            description=log.description or "Income Distribution",
            date=log.date,
            strategy_name=log.strategy_name,
            income_source=log.income_source
        ))

    for exp in expenses:
        ledger_items.append(schemas.LedgerItem(
            id=exp.id,
            type="expense",
            amount=abs(exp.amount), # Show positive amount for display
            description=exp.description,
            date=exp.date,
            jar_type=exp.jar_type
        ))

    # Sort by date desc
    ledger_items.sort(key=lambda x: x.date, reverse=True)
    
    return ledger_items

@router.get("/balances", response_model=List[schemas.JarBalance])
async def get_balances(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get current balance for each jar.
    """
    # Initialize balances
    balances = {
        "NEC": 0.0, "FFA": 0.0, "EDU": 0.0, 
        "LTSS": 0.0, "PLAY": 0.0, "GIVE": 0.0
    }
    
    result = await db.execute(
        select(models.JarTransaction)
        .where(models.JarTransaction.user_id == current_user.id)
    )
    transactions = result.scalars().all()
    
    for txn in transactions:
        if txn.jar_type in balances:
            balances[txn.jar_type] += txn.amount
            
    return [
        schemas.JarBalance(jar_type=k, balance=v) 
        for k, v in balances.items()
    ]

# ======================
# Distribute Income
# ======================

@router.post("/distribute")
async def distribute_income(
    amount: float,
    strategy_id: int,
    description: str = "Income Distribution",
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Distribute income according to the selected strategy.
    """
    # 1. Get Strategy
    result = await db.execute(select(models.JarStrategy).where(models.JarStrategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    # 2. Create Income Log
    income_log = models.IncomeLog(
        user_id=current_user.id,
        amount=amount,
        strategy_name=strategy.name,
        description=description,
        date=datetime.utcnow()
    )
    db.add(income_log)
    await db.flush() # Get ID
    
    # 3. Create Jar Transactions
    jars = {
        "NEC": strategy.nec, "FFA": strategy.ffa, "EDU": strategy.edu,
        "LTSS": strategy.ltss, "PLAY": strategy.play, "GIVE": strategy.give
    }
    
    for jar_type, percentage in jars.items():
        if percentage > 0:
            jar_amount = amount * percentage
            txn = models.JarTransaction(
                user_id=current_user.id,
                jar_type=jar_type,
                amount=jar_amount,
                description=f"Income Distribution ({strategy.name})",
                date=datetime.utcnow(),
                income_log_id=income_log.id
            )
            db.add(txn)
            
    await db.commit()
    return {"message": "Income distributed successfully"}

@router.post("/spend")
async def spend_money(
    amount: float,
    jar_type: str,
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Log an expense (spend money) from a specific jar.
    """
    # Validate Jar Type
    valid_jars = ["NEC", "FFA", "EDU", "LTSS", "PLAY", "GIVE"]
    if jar_type not in valid_jars:
        raise HTTPException(status_code=400, detail="Invalid jar type")
        
    # Create Transaction (Negative amount)
    txn = models.JarTransaction(
        user_id=current_user.id,
        jar_type=jar_type,
        amount=-abs(amount), # Ensure negative
        description=description,
        date=datetime.utcnow()
    )
    db.add(txn)
    await db.commit()
    return {"message": "Expense logged successfully"}

# ======================
# Income Sources
# ======================

@router.get("/income-sources", response_model=List[schemas.IncomeSourceRead])
async def get_income_sources(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.IncomeSource)
        .where(models.IncomeSource.user_id == current_user.id)
    )
    return result.scalars().all()

@router.post("/income-sources", response_model=schemas.IncomeSourceRead)
async def create_income_source(
    source: schemas.IncomeSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_source = models.IncomeSource(name=source.name, user_id=current_user.id)
    db.add(db_source)
    await db.commit()
    await db.refresh(db_source)
    return db_source

@router.delete("/income-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.IncomeSource)
        .where(models.IncomeSource.id == source_id, models.IncomeSource.user_id == current_user.id)
    )
    db_source = result.scalar_one_or_none()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    await db.delete(db_source)
    await db.commit()
    return None

@router.get("/monthly-summary")
async def get_monthly_summary(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Aggregate income by month and jar.
    Returns a list of dicts: {month: "YYYY-MM", NEC: 100, FFA: 20, ..., total: 120}
    """
    # Fetch all income transactions (positive amounts)
    result = await db.execute(
        select(models.JarTransaction)
        .where(
            models.JarTransaction.user_id == current_user.id,
            models.JarTransaction.amount > 0
        )
        .order_by(models.JarTransaction.date.desc())
    )
    transactions = result.scalars().all()
    
    summary = {} # "YYYY-MM" -> {NEC: 0, FFA: 0, ...}
    
    for txn in transactions:
        month_key = txn.date.strftime("%Y-%m")
        if month_key not in summary:
            summary[month_key] = {
                "month": month_key,
                "NEC": 0.0, "FFA": 0.0, "EDU": 0.0,
                "LTSS": 0.0, "PLAY": 0.0, "GIVE": 0.0,
                "total": 0.0
            }
        
        if txn.jar_type in summary[month_key]:
            summary[month_key][txn.jar_type] += txn.amount
            summary[month_key]["total"] += txn.amount
            
    return list(summary.values())

@router.get("/jar/{jar_type}", response_model=List[schemas.JarTransactionRead])
async def get_jar_history(
    jar_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all transactions for a specific jar.
    """
    result = await db.execute(
        select(models.JarTransaction)
        .where(
            models.JarTransaction.user_id == current_user.id,
            models.JarTransaction.jar_type == jar_type
        )
        .order_by(models.JarTransaction.date.desc())
    )
    return result.scalars().all()

@router.delete("/transactions/{type}/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    type: str,
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Delete a transaction (income or expense).
    - If income: Delete IncomeLog (cascades to JarTransactions)
    - If expense: Delete JarTransaction directly
    """
    if type == "income":
        # Delete IncomeLog -> Cascades to JarTransactions via model relationship
        result = await db.execute(
            select(models.IncomeLog)
            .options(selectinload(models.IncomeLog.jar_transactions))
            .where(models.IncomeLog.id == id, models.IncomeLog.user_id == current_user.id)
        )
        record = result.scalar_one_or_none()
    elif type == "expense":
        # Delete JarTransaction
        result = await db.execute(
            select(models.JarTransaction)
            .where(models.JarTransaction.id == id, models.JarTransaction.user_id == current_user.id)
        )
        record = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")
        
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    await db.delete(record)
    await db.commit()
    return None

@router.put("/transactions/{type}/{id}")
async def update_transaction(
    type: str,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update a transaction.
    """
    if type == "income":
        result = await db.execute(
            select(models.IncomeLog)
            .where(models.IncomeLog.id == id, models.IncomeLog.user_id == current_user.id)
        )
        record = result.scalar_one_or_none()
        if record:
            if "amount" in data:
                # This is complex because changing amount requires recalculating splits
                # For now, we might block amount updates or implement full recalculation logic
                # Let's just update description/date/source for now
                pass 
            if "description" in data:
                record.description = data["description"]
            if "date" in data:
                record.date = datetime.fromisoformat(data["date"].replace("Z", "+00:00"))
            if "income_source" in data:
                record.income_source = data["income_source"]
                
    elif type == "expense":
        result = await db.execute(
            select(models.JarTransaction)
            .where(models.JarTransaction.id == id, models.JarTransaction.user_id == current_user.id)
        )
        record = result.scalar_one_or_none()
        if record:
            if "amount" in data:
                record.amount = -abs(float(data["amount"])) # Ensure negative
            if "description" in data:
                record.description = data["description"]
            if "date" in data:
                record.date = datetime.fromisoformat(data["date"].replace("Z", "+00:00"))
                
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")

    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await db.commit()
    return {"message": "Transaction updated"}