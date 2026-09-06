from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from voyage_ai.ai.planner import generate_trip_plan
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.auth.security import bearer_scheme
from voyage_ai.auth.service import get_current_user
from voyage_ai.database import get_db
from voyage_ai.trips.model import Trip
from voyage_ai.trips.schemas import TripCreate, TripDetail, TripGenerationRequest
from voyage_ai.trips.service import save_trip

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post(
    "/generate",
    response_model=TripPlan,
)
async def generate_trip(
    data: TripGenerationRequest,
) -> TripPlan:
    try:
        return await generate_trip_plan(data)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate a trip plan. Please try again.",
        ) from exc


@router.post(
    "",
    response_model=TripDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_trip(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[
        HTTPAuthorizationCredentials,
        Depends(bearer_scheme),
    ],
    data: TripCreate,
) -> Trip:
    user = await get_current_user(db, credentials.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await save_trip(db, user.id, data)
