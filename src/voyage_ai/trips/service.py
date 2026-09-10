from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from voyage_ai.ai.planner import generate_trip_plan, refine_trip_plan
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.ai.uploads import UploadedAttachment
from voyage_ai.places.service import enrich_trip_plan
from voyage_ai.trips.model import Trip
from voyage_ai.trips.schemas import (
    TripCreate,
    TripGenerationRequest,
    TripRefinementRequest,
    TripUpdate,
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


async def get_public_trips(
    db: AsyncSession,
) -> list[Trip]:
    result = await db.execute(
        select(Trip)
        .options(selectinload(Trip.user))
        .where(Trip.is_public.is_(True))
        .order_by(Trip.created_at.desc()),
    )

    return list(result.scalars().all())


async def get_trip_by_id(
    db: AsyncSession,
    trip_id: int,
) -> Trip | None:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id),
    )
    trip = result.scalars().one_or_none()

    return trip


async def update_trip_params(
    db: AsyncSession,
    trip: Trip,
    data: TripUpdate,
) -> Trip:
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)

    for field, value in update_data.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)
    return trip


async def remove_trip(
    db: AsyncSession,
    trip: Trip,
) -> None:

    await db.delete(trip)
    await db.commit()


async def refine_saved_trip(
    db: AsyncSession,
    trip: Trip,
    data: TripRefinementRequest,
) -> Trip:
    current_trip_plan = TripPlan.model_validate(trip.trip_plan)

    original_generation_request = TripGenerationRequest.model_validate(
        trip.generation_request,
    )

    refined_plan = await refine_trip_plan(
        data,
        current_trip_plan,
        original_generation_request,
    )

    enriched_plan = await enrich_trip_plan(refined_plan)

    trip.trip_plan = enriched_plan.model_dump(mode="json")

    await db.commit()
    await db.refresh(trip)

    return trip


async def generate_trip(
    data: TripGenerationRequest, attachments: list[UploadedAttachment]
) -> TripPlan:
    trip_plan = await generate_trip_plan(data, attachments)
    return await enrich_trip_plan(trip_plan)
