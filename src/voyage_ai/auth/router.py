from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from voyage_ai.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from voyage_ai.auth.service import login_user, register_user
from voyage_ai.database import get_db
from voyage_ai.users.schemas import UserPrivate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserPrivate,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    db: Annotated[AsyncSession, Depends(get_db)],
    data: RegisterRequest,
):
    user = await register_user(db, data)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    db: Annotated[AsyncSession, Depends(get_db)],
    data: LoginRequest,
):
    token = await login_user(db, data)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token
