from datetime import date
from decimal import Decimal

from openai import AsyncOpenAI

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.config import settings
from voyage_ai.trips.schemas import TripGenerationRequest

client = AsyncOpenAI(
    api_key=settings.openai_api_key.get_secret_value(),
)


async def generate_trip_plan(request: TripGenerationRequest) -> TripPlan:
    response = await client.responses.parse(
        model="gpt-5.6-luna",
        instructions=TRIP_PLANNER_INSTRUCTIONS,
        input=request.model_dump_json(),
        text_format=TripPlan,
    )
    trip_plan = response.output_parsed

    if trip_plan is None:
        raise RuntimeError("OpenAI returned no structured trip plan")

    return trip_plan


if __name__ == "__main__":
    import asyncio

    test_data = TripGenerationRequest(
        destination="Rome",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 5),
        budget=Decimal(2000),
        currency="USD",
        travellers=1,
        travel_pace="balanced",
        preferences="I wanna visit all historical sites",
    )

    result = asyncio.run(
        generate_trip_plan(
            test_data,
        )
    )

    print(result)
