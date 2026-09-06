from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from voyage_ai.trips.model import Trip
from voyage_ai.trips.schemas import (
    TripCreate,
)


async def save_trip(
    db: AsyncSession,
    user_id: int,
    data: TripCreate,
) -> Trip:
    destination = data.generation_request.destination

    new_trip = Trip(
        user_id=user_id,
        title=data.title or f"{destination} trip",
        destination=destination,
        start_date=data.generation_request.start_date,
        end_date=data.generation_request.end_date,
        generation_request=data.generation_request.model_dump(mode="json"),
        trip_plan=data.trip_plan.model_dump(mode="json"),
    )

    db.add(new_trip)
    await db.commit()
    await db.refresh(new_trip)
    return new_trip


async def get_user_trips(
    db: AsyncSession,
    user_id: int,
) -> list[Trip]:
    result = await db.execute(
        select(Trip).where(Trip.user_id == user_id).order_by(Trip.created_at.desc()),
    )

    return list(result.scalars().all())
