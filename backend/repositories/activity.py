from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import ActivityLog


async def log_activity(session: AsyncSession, user_id: int, action: str, target_type: str = None, target_id: int = None):
    log = ActivityLog(user_id=user_id, action=action, target_type=target_type, target_id=target_id)
    session.add(log)
    await session.commit()
