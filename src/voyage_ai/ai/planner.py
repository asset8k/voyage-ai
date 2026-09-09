import json
import logging
import time

from openai import AsyncOpenAI

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS, TRIP_REFINER_INSTRUCTIONS
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.config import settings
from voyage_ai.trips.schemas import TripGenerationRequest, TripRefinementRequest

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


async def refine_trip_plan(
    refinement: TripRefinementRequest,
    current_trip_plan: TripPlan,
    original_generation_request: TripGenerationRequest,
) -> TripPlan:
    started_at = time.perf_counter()

    input_payload = {
        "original_generation_request": original_generation_request.model_dump(
            mode="json",
        ),
        "current_trip_plan": current_trip_plan.model_dump(mode="json"),
        "refinement_instruction": refinement.instruction,
    }

    response = await client.responses.parse(
        model="gpt-5.6-luna",
        instructions=TRIP_REFINER_INSTRUCTIONS,
        input=json.dumps(input_payload),
        text_format=TripPlan,
    )

    model = response.model
    latency_ms = (time.perf_counter() - started_at) * 1000
    usage = response.usage
    input_tokens = usage.input_tokens if usage else None
    output_tokens = usage.output_tokens if usage else None
    total_tokens = usage.total_tokens if usage else None

    new_trip_plan = response.output_parsed

    if new_trip_plan is None:
        raise RuntimeError("OpenAI returned no structured refined trip plan")

    logger.info(
        "Trip refinement completed: model=%s latency_ms=%.0f "
        "input_tokens=%s output_tokens=%s total_tokens=%s",
        model,
        latency_ms,
        input_tokens,
        output_tokens,
        total_tokens,
    )
    return new_trip_plan
