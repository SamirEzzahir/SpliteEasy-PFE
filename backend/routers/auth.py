from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas, crud, auth
from ..db import get_session

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
