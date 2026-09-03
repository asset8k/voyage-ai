from fastapi import (
    APIRouter,
    HTTPException,
    status,
)

from voyage_ai.ai.planner import generate_trip_plan
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.trips.schemas import TripGenerationRequest

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
