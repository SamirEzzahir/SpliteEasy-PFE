from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from .. import models, schemas
from ..dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/econome",
    tags=["econome"],
    responses={404: {"description": "Not found"}},
)

# ======================
# Strategy Endpoints
# ======================

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
    # 1. Fetch Strategy
    result = await db.execute(select(models.JarStrategy).where(models.JarStrategy.id == strategy_id))
    strategy = result.scalar_one_or_none()

    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # 2. Create Income Log
    income_log = models.IncomeLog(
        user_id=current_user.id,
        amount=amount,
        income_source=description, 
        strategy_name=strategy.name,
        description="Distributed via " + strategy.name,
        date=datetime.utcnow()
    )
    db.add(income_log)
    await db.flush() # Get ID

    # 3. Calculate Splits
    allocations = {
        "NEC": strategy.nec,
        "FFA": strategy.ffa,
        "EDU": strategy.edu,
        "LTSS": strategy.ltss,
        "PLAY": strategy.play,
        "GIVE": strategy.give
    }

    # 4. Create Jar Transactions
    for jar, percent in allocations.items():
        if percent > 0:
            share = amount * percent
            jar_txn = models.JarTransaction(
                user_id=current_user.id,
                income_log_id=income_log.id, # Link to IncomeLog
                jar_type=jar,
                amount=share,
                description=f"Distribution from {description}",
                date=datetime.utcnow()
            )
            db.add(jar_txn)

    await db.commit()
    return {"message": "Income distributed successfully"}


# ======================
# Spend from Jar
# ======================

@router.post("/spend")
async def spend_from_jar(
    amount: float,
    jar_type: str,
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Create negative transaction
    txn = models.JarTransaction(
        user_id=current_user.id,
        jar_type=jar_type,
        amount=-amount, # Negative for expense
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
    result = await db.execute(select(models.IncomeSource).where(models.IncomeSource.user_id == current_user.id))
    return result.scalars().all()

@router.post("/income-sources", response_model=schemas.IncomeSourceRead)
async def create_income_source(
    source: schemas.IncomeSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_source = models.IncomeSource(user_id=current_user.id, name=source.name)
    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)
    return new_source

@router.delete("/income-sources/{source_id}")
async def delete_income_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(select(models.IncomeSource).where(models.IncomeSource.id == source_id, models.IncomeSource.user_id == current_user.id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    await db.delete(source)
    await db.commit()
    return {"message": "Source deleted"}


# ======================
# Monthly Summary
# ======================

@router.get("/monthly-summary")
async def get_monthly_summary(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.JarTransaction)
        .where(models.JarTransaction.user_id == current_user.id)
        .order_by(models.JarTransaction.date.desc())
    )
    txns = result.scalars().all()

    summary = {} 

    for t in txns:
        month_key = t.date.strftime("%Y-%m")
        if month_key not in summary:
            summary[month_key] = {"month": month_key, "NEC": 0, "FFA": 0, "EDU": 0, "LTSS": 0, "PLAY": 0, "GIVE": 0, "total": 0}
        
        if t.jar_type in summary[month_key]:
            summary[month_key][t.jar_type] += t.amount
            summary[month_key]["total"] += t.amount

    return list(summary.values())


# ======================
# Jar History
# ======================

@router.get("/jar/{jar_type}", response_model=List[schemas.JarTransactionRead])
async def get_jar_history(
    jar_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.JarTransaction)
        .where(
            models.JarTransaction.user_id == current_user.id,
            models.JarTransaction.jar_type == jar_type
        )
        .order_by(models.JarTransaction.date.desc())
    )
    return result.scalars().all()


# ======================
# Transaction Management
# ======================

@router.delete("/transactions/{type}/{id}")
async def delete_transaction(
    type: str,
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if type == "income":
        # Delete IncomeLog -> Cascades to JarTransactions via model relationship
        result = await db.execute(
            select(models.IncomeLog)
            .options(selectinload(models.IncomeLog.jar_transactions))
            .where(models.IncomeLog.id == id, models.IncomeLog.user_id == current_user.id)
        )
        item = result.scalar_one_or_none()
    elif type == "expense" or type == "jar_transaction":
        # Delete JarTransaction (Expense)
        result = await db.execute(select(models.JarTransaction).where(models.JarTransaction.id == id, models.JarTransaction.user_id == current_user.id))
        item = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    if not item:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Transaction deleted"}


@router.put("/transactions/{type}/{id}")
async def update_transaction(
    type: str,
    id: int,
    update_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if type == "income":
        # Update IncomeLog -> Update linked JarTransactions proportionally
        result = await db.execute(
            select(models.IncomeLog)
            .options(selectinload(models.IncomeLog.jar_transactions))
            .where(models.IncomeLog.id == id, models.IncomeLog.user_id == current_user.id)
        )
        income_log = result.scalar_one_or_none()
        
        if not income_log:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        # Validate with Schema
        schema = schemas.IncomeLogUpdate(**update_data)
        
        if schema.amount is not None and schema.amount != income_log.amount:
            # Calculate ratio
            if income_log.amount == 0:
                ratio = 0 
            else:
                ratio = schema.amount / income_log.amount
            
            # Update linked transactions
            for txn in income_log.jar_transactions:
                txn.amount = txn.amount * ratio
            
            income_log.amount = schema.amount

        if schema.description is not None:
            income_log.description = schema.description
        if schema.income_source is not None:
            income_log.income_source = schema.income_source
        if schema.date is not None:
            income_log.date = schema.date
            
    elif type == "expense" or type == "jar_transaction":
        # Update JarTransaction
        result = await db.execute(select(models.JarTransaction).where(models.JarTransaction.id == id, models.JarTransaction.user_id == current_user.id))
        txn = result.scalar_one_or_none()
        
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        schema = schemas.JarTransactionUpdate(**update_data)
        
        if schema.amount is not None:
            if txn.amount < 0:
                txn.amount = -abs(schema.amount)
            else:
                txn.amount = abs(schema.amount)
                
        if schema.description is not None:
            txn.description = schema.description
        if schema.date is not None:
            txn.date = schema.date

    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    await db.commit()
    return {"message": "Transaction updated"}