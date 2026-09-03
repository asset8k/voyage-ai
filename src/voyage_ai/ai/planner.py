import logging
import time
from datetime import date
from decimal import Decimal

from openai import AsyncOpenAI

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.config import settings
from voyage_ai.trips.schemas import TripGenerationRequest

logger = logging.getLogger(__name__)

client = AsyncOpenAI(
    api_key=settings.openai_api_key.get_secret_value(),
)


async def generate_trip_plan(request: TripGenerationRequest) -> TripPlan:
    started_at = time.perf_counter()

    response = await client.responses.parse(
        model="gpt-5.6-luna",
        instructions=TRIP_PLANNER_INSTRUCTIONS,
        input=request.model_dump_json(),
        text_format=TripPlan,
    )

    model = response.model
    latency_ms = (time.perf_counter() - started_at) * 1000
    usage = response.usage
    input_tokens = usage.input_tokens if usage else None
    output_tokens = usage.output_tokens if usage else None
    total_tokens = usage.total_tokens if usage else None

    trip_plan = response.output_parsed

    if trip_plan is None:
        raise RuntimeError("OpenAI returned no structured trip plan")

    logger.info(
        "Trip generation completed: model=%s latency_ms=%.0f "
        "input_tokens=%s output_tokens=%s total_tokens=%s",
        model,
        latency_ms,
        input_tokens,
        output_tokens,
        total_tokens,
    )
    return trip_plan


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    import asyncio

    test_request = TripGenerationRequest(
        destination="Rome",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 5),
        budget=Decimal(1500),
        currency="USD",
        travellers=1,
        travel_pace="balanced",
        preferences="History, Italian food, and walkable sightseeing.",
    )

    result = asyncio.run(generate_trip_plan(test_request))
    print(result)
