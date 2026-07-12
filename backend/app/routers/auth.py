from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas, crud, auth
from app.db import get_session
from app.models import User
from app.core import settings_store

router = APIRouter(prefix="/auth")

@router.post("/register", response_model=schemas.UserRead)
async def register(user: schemas.UserCreate, session: AsyncSession = Depends(get_session)):
    # Respect the platform "registration enabled" + password-policy settings.
    if not settings_store.get_bool("registration_enabled"):
        raise HTTPException(status_code=403, detail="New registrations are currently disabled")
    min_len = settings_store.get_int("password_min_length")
    if len(user.password) < min_len:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_len} characters")
    if await crud.get_user_by_username(session, user.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if await crud.get_user_by_email(session, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = await crud.create_user(session, user)

    # ✅ Create default "Personal Expenses" group
    personal_group = schemas.GroupCreate(
        title="Personal Expenses",
        type="Personal",
        currency="USD", 
        member_ids=[]
    )
    await crud.create_group(session, personal_group, new_user)

    return schemas.UserRead.model_validate(new_user)

@router.post("/login", response_model=schemas.Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    user = await auth.authenticate(session, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid crsssedentials")
    
    # ✅ Check and create default "Personal Expenses" group if missing
    user_groups = await crud.get_groups(session, user)
    has_personal_group = any(g.type == "Personal" and g.title == "Personal Expenses" for g in user_groups)
    
    if not has_personal_group:
        personal_group = schemas.GroupCreate(
            title="Personal Expenses",
            type="Personal",
            currency="USD", 
            member_ids=[]
        )
        await crud.create_group(session, personal_group, user)

    # Record last login for the admin panel, then mint a token bound to the
    # user's current token_version (see core/auth.create_access_token).
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    await session.commit()

    minutes = settings_store.get_int("session_timeout_minutes") or None
    token = auth.create_access_token(
        user.username, ver=user.token_version or 0,
        **({"minutes": minutes} if minutes else {}),
    )
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserRead)
async def fetch_current_user(current: User = Depends(auth.get_current_user)):
    print(f"DEBUG: User ID: {current.id}, Role ID: {current.role_id}")
    if current.role:
        print(f"DEBUG: Role Loaded: {current.role.name}")
    else:
        print("DEBUG: Role NOT Loaded")
    
    response = schemas.UserRead.model_validate(current, from_attributes=True)
    print(f"DEBUG: Serialized Response: {response.model_dump()}")
    return response
