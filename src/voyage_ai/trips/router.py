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
from voyage_ai.auth.dependencies import get_optional_current_user, require_current_user
from voyage_ai.database import get_db
from voyage_ai.trips.model import Trip
from voyage_ai.trips.schemas import (
    TripCreate,
    TripDetail,
    TripGenerationRequest,
    TripListItem,
    TripUpdate,
)
from voyage_ai.trips.service import (
    get_trip_by_id,
    get_user_trips,
    remove_trip,
    save_trip,
    update_trip_params,
)
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


@router.get("/{trip_id}", response_model=TripDetail)
async def get_trip(
    db: Annotated[AsyncSession, Depends(get_db)],
    trip_id: int,
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> Trip:

    trip = await get_trip_by_id(db, trip_id)

    is_owner = (
        current_user is not None
        and trip is not None
        and (trip.user_id == current_user.id)
    )

    if trip is None or (not trip.is_public and not is_owner):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    return trip


@router.patch("/{trip_id}", response_model=TripDetail)
async def update_trip(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_current_user)],
    trip_id: int,
    data: TripUpdate,
) -> Trip:
    trip = await get_trip_by_id(db, trip_id)

    if trip is None or trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    return await update_trip_params(db, trip, data)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_current_user)],
    trip_id: int,
) -> None:
    trip = await get_trip_by_id(db, trip_id)

    if trip is None or trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    await remove_trip(db, trip)
