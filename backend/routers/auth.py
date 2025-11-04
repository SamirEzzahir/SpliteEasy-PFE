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
    return schemas.UserRead.model_validate(new_user)

@router.post("/login", response_model=schemas.Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    user = await auth.authenticate(session, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = auth.create_access_token(user.username)
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserRead)
async def fetch_current_user(current: User = Depends(auth.get_current_user)):
    return schemas.UserRead.model_validate(current, from_attributes=True)
