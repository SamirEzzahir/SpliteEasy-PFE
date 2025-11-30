from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List
import json

from backend.db import get_session
from backend.models import User, Role, Reclamation, ReclamationStatus
from backend import schemas
from backend.dependencies import require_permission

router = APIRouter(prefix="/admin", tags=["Admin"])

# ======================
# User Management
# ======================

from sqlalchemy.orm import selectinload

@router.get("/users", response_model=List[schemas.UserRead])
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_users"))
):
    result = await session.execute(
        select(User).options(selectinload(User.role)).offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.post("/users/{user_id}/role")
async def assign_role(
    user_id: int, 
    role_id: int, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users"))
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    user.role_id = role_id
    await session.commit()
    return {"message": f"Role '{role.name}' assigned to user '{user.username}'"}

@router.post("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users"))
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent disabling yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    user.is_active = not user.is_active
    await session.commit()
    status_str = "enabled" if user.is_active else "disabled"
    return {"message": f"User '{user.username}' has been {status_str}"}

# ======================
# Role Management
# ======================

@router.get("/roles", response_model=List[schemas.RoleRead])
async def get_roles(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_roles"))
):
    result = await session.execute(select(Role))
    return result.scalars().all()

@router.post("/roles", response_model=schemas.RoleRead)
async def create_role(
    role: schemas.RoleCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_roles"))
):
    # Check if exists
    result = await session.execute(select(Role).where(Role.name == role.name))
    if result.scalar():
        raise HTTPException(status_code=400, detail="Role already exists")
    
    new_role = Role(name=role.name, permissions=role.permissions)
    session.add(new_role)
    await session.commit()
    await session.refresh(new_role)
    return new_role

# ======================
# Reclamation Management
# ======================

@router.get("/reclamations", response_model=List[schemas.ReclamationRead])
async def get_reclamations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_reclamations"))
):
    result = await session.execute(select(Reclamation).order_by(Reclamation.created_at.desc()))
    return result.scalars().all()

@router.post("/reclamations/{rec_id}/status")
async def update_reclamation_status(
    rec_id: int,
    status_update: schemas.ReclamationUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_reclamations"))
):
    rec = await session.get(Reclamation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Reclamation not found")
        
    try:
        new_status = ReclamationStatus(status_update.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    rec.status = new_status
    await session.commit()
    return {"message": f"Reclamation status updated to {new_status.value}"}
