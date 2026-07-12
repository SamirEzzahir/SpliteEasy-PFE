from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.auth import get_current_user
from app.crud import add_members_to_group, ensure_user_in_group, ensure_user_is_admin, get_group_members, log_activity, remove_member, update_membership
from app.db import get_session
from app.models import Group, Membership, User
from app.schemas import MembershipRead, MembershipBase, MembershipUpdate

router = APIRouter(prefix="/groups")



# -------------------
# Get all members
# -------------------
@router.get("/{group_id}/members", response_model=list[MembershipRead])
async def list_group_members(group_id: int, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    await ensure_user_in_group(session, current.id, group_id)
    return await get_group_members(session, group_id)


# -------------------
# Add members
# -------------------
@router.post("/{group_id}/add_members", response_model=list[MembershipRead])
async def add_members(group_id: int, payload: dict, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    await ensure_user_is_admin(session, current.id, group_id)
    await ensure_user_in_group(session, current.id, group_id)
    memberships = await add_members_to_group(
        session, group_id, payload["user_ids"], payload.get("is_admin", False)
    )
        # Fetch the group
    group = await session.get(Group, group_id)
    group_name = group.title if group else f"ID {group_id}"
    
    users_res = await session.execute(select(User.username).where(User.id.in_(payload["user_ids"])))
    added_users = [row[0] for row in users_res.all()]
    
    # Log activity
    await log_activity(
        session,
        current.id,
        f"Added members {', '.join(added_users)} to group {group_name}",
        target_type="Group",
        target_id=group_id
    )
    return [MembershipRead.model_validate(m, from_attributes=True) for m in memberships]


# -------------------
# Update membership
# -------------------
@router.put("/{group_id}/members/{member_id}", response_model=MembershipRead)
async def update_member(group_id: int, member_id: int, payload: MembershipUpdate, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    await ensure_user_is_admin(session, current.id, group_id)
    membership = await update_membership(session, group_id, member_id, payload.is_admin)
    return MembershipRead.model_validate(membership, from_attributes=True)


# -------------------
# Remove member
# -------------------
@router.delete("/{group_id}/members/{member_id}", status_code=204)
async def delete_member(group_id: int, member_id: int, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    await ensure_user_is_admin(session, current.id, group_id)
    await remove_member(session, group_id, member_id)
    user = await session.get(User, member_id)
    username = user.username if user else f"ID {member_id}"
    group = await session.get(Group, group_id)
    group_name = group.title if group else f"ID {group_id}"

    # Log activity
    await log_activity(
        session,
        current.id,
        f"Removed member {username} from group {group_name}",
        target_type="Group",
        target_id=group_id
    )

    
    return


