from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from voyage_ai.ai.planner import generate_trip_plan
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.auth.dependencies import require_current_user
from voyage_ai.database import get_db
from voyage_ai.trips.model import Trip
from voyage_ai.trips.schemas import (
    TripCreate,
    TripDetail,
    TripGenerationRequest,
    TripListItem,
)
from voyage_ai.trips.service import get_user_trips, save_trip
from voyage_ai.users.model import User

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
    current_user: Annotated[User, Depends(require_current_user)],
    data: TripCreate,
) -> Trip:
    return await save_trip(db, current_user.id, data)


@router.get("/mine", response_model=list[TripListItem])
async def get_my_trips(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_current_user)],
) -> list[Trip]:

    return await get_user_trips(db, current_user.id)
