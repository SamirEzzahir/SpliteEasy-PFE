from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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

@router.get("/ledger", response_model=List[schemas.JarTransactionRead])
async def get_ledger(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all jar transactions for the user.
    """
    result = await db.execute(
        select(models.JarTransaction)
        .where(models.JarTransaction.user_id == current_user.id)
        .order_by(models.JarTransaction.date.desc())
    )
    return result.scalars().all()

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

@router.post("/distribute")
async def distribute_income(
    amount: float,
    strategy_id: int,
    description: str = "Income Distribution",
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Distribute an income amount into jars based on a strategy.
    """
    # Fetch strategy
    result = await db.execute(select(models.JarStrategy).where(models.JarStrategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    
    if not strategy:
        # Fallback to default if not found (shouldn't happen with valid ID)
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    # Calculate splits
    splits = {
        "NEC": amount * strategy.nec,
        "FFA": amount * strategy.ffa,
        "EDU": amount * strategy.edu,
        "LTSS": amount * strategy.ltss,
        "PLAY": amount * strategy.play,
        "GIVE": amount * strategy.give
    }
    
    # Create transactions
    new_txns = []
    for jar, jar_amount in splits.items():
        if jar_amount > 0:
            txn = models.JarTransaction(
                user_id=current_user.id,
                jar_type=jar,
                amount=jar_amount,
                description=description
            )
            new_txns.append(txn)
            
    db.add_all(new_txns)
    await db.commit()
    return {"message": "Income distributed successfully", "transactions": len(new_txns)}

@router.post("/spend")
async def spend_from_jar(
    jar_type: str,
    amount: float,
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Log an expense from a specific jar.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
        
    txn = models.JarTransaction(
        user_id=current_user.id,
        jar_type=jar_type,
        amount=-amount, # Negative for expense
        description=description
    )
    
    db.add(txn)
    await db.commit()
    return {"message": "Expense logged successfully"}

# ======================
# Income Source Endpoints
# ======================

@router.get("/income-sources", response_model=List[schemas.IncomeSourceRead])
async def get_income_sources(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all income sources for the user.
    """
    result = await db.execute(select(models.IncomeSource).where(models.IncomeSource.user_id == current_user.id))
    return result.scalars().all()

@router.post("/income-sources", response_model=schemas.IncomeSourceRead)
async def create_income_source(
    source: schemas.IncomeSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new income source.
    """
    db_source = models.IncomeSource(
        **source.model_dump(),
        user_id=current_user.id
    )
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
    """
    Delete an income source.
    """
    result = await db.execute(select(models.IncomeSource).where(
        models.IncomeSource.id == source_id,
        models.IncomeSource.user_id == current_user.id
    ))
    db_source = result.scalar_one_or_none()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Income source not found")
        
    await db.delete(db_source)
    await db.commit()
    return None

# ======================
# Monthly Summary Endpoint
# ======================

@router.get("/monthly-summary", response_model=List[schemas.MonthlySummary])
async def get_monthly_summary(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get monthly summary of transactions aggregated by jar type.
    """
    # Fetch all transactions for the user
    result = await db.execute(
        select(models.JarTransaction)
        .where(models.JarTransaction.user_id == current_user.id)
        .order_by(models.JarTransaction.date.desc())
    )
    transactions = result.scalars().all()
    
    # Aggregate data
    summary_data = {}
    
    for txn in transactions:
        month_key = txn.date.strftime("%B %Y") # e.g., "January 2024"
        
        if month_key not in summary_data:
            summary_data[month_key] = {
                "month": month_key,
                "NEC": 0.0, "FFA": 0.0, "EDU": 0.0,
                "LTSS": 0.0, "PLAY": 0.0, "GIVE": 0.0,
                "total": 0.0
            }
            
        # Add to specific jar
        if txn.jar_type in summary_data[month_key]:
            summary_data[month_key][txn.jar_type] += txn.amount
            
        # Add to total (sum of all jars for that month)
        summary_data[month_key]["total"] += txn.amount

    return list(summary_data.values())