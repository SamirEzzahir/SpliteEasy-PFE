from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend import schemas, crud, auth
from backend.db import get_session
from backend.models import User

router = APIRouter(prefix="/auth")

@router.post("/register", response_model=schemas.UserRead)
async def register(user: schemas.UserCreate, session: AsyncSession = Depends(get_session)):
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
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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

    token = auth.create_access_token(user.username)
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
