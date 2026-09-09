import json
import logging
import time

from openai import AsyncOpenAI
from openai.types.responses import ParsedResponse, ResponseInputItemParam

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS, TRIP_REFINER_INSTRUCTIONS
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.ai.tools import WEATHER_TOOL, get_weather
from voyage_ai.config import settings
from voyage_ai.trips.schemas import TripGenerationRequest, TripRefinementRequest

logger = logging.getLogger(__name__)

client = AsyncOpenAI(
    api_key=settings.openai_api_key.get_secret_value(),
)


def log_ai_metrics(
    operation: str,
    started_at: float,
    responses: list[ParsedResponse[TripPlan]],
    tool_call_count: int = 0,
) -> None:
    latency_ms = (time.perf_counter() - started_at) * 1000

    input_tokens = sum(
        response.usage.input_tokens
        for response in responses
        if response.usage is not None
    )
    output_tokens = sum(
        response.usage.output_tokens
        for response in responses
        if response.usage is not None
    )
    total_tokens = sum(
        response.usage.total_tokens
        for response in responses
        if response.usage is not None
    )

    logger.info(
        "%s completed: model=%s latency_ms=%.0f api_calls=%d "
        "tool_calls=%d input_tokens=%d output_tokens=%d total_tokens=%d",
        operation,
        responses[-1].model,
        latency_ms,
        len(responses),
        tool_call_count,
        input_tokens,
        output_tokens,
        total_tokens,
    )


async def generate_trip_plan(request: TripGenerationRequest) -> TripPlan:
    started_at = time.perf_counter()

    first_response = await client.responses.parse(
        model="gpt-5.6-luna",
        instructions=TRIP_PLANNER_INSTRUCTIONS,
        input=request.model_dump_json(),
        text_format=TripPlan,
        tools=[WEATHER_TOOL],
    )

    responses = [first_response]

    tool_outputs: list[ResponseInputItemParam] = []

    for item in first_response.output:
        if item.type == "function_call" and item.name == "get_weather":
            arguments = json.loads(item.arguments)

            weather = await get_weather(**arguments)

            tool_outputs.append(
                {
                    "type": "function_call_output",
                    "call_id": item.call_id,
                    "output": json.dumps(weather),
                },
            )

    if not tool_outputs:
        trip_plan = first_response.output_parsed

        if trip_plan is None:
            raise RuntimeError("OpenAI returned no structured trip plan")

        log_ai_metrics(
            operation="Trip generation",
            started_at=started_at,
            responses=responses,
        )

        return trip_plan

    final_response = await client.responses.parse(
        model="gpt-5.6-luna",
        instructions=TRIP_PLANNER_INSTRUCTIONS,
        previous_response_id=first_response.id,
        input=tool_outputs,
        text_format=TripPlan,
    )

    responses.append(final_response)

    trip_plan = final_response.output_parsed

    if trip_plan is None:
        raise RuntimeError("OpenAI returned no structured trip plan")

    log_ai_metrics(
        operation="Trip generation",
        started_at=started_at,
        responses=responses,
        tool_call_count=len(tool_outputs),
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

    responses = [response]

    new_trip_plan = response.output_parsed

    if new_trip_plan is None:
        raise RuntimeError("OpenAI returned no structured refined trip plan")

    log_ai_metrics(
        operation="Trip refinement",
        started_at=started_at,
        responses=responses,
    )

    return new_trip_plan
