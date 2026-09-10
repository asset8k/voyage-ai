import base64
import json
import logging
import time

from openai import AsyncOpenAI
from openai.types.responses import (
    ParsedResponse,
    ResponseInputContentParam,
    ResponseInputItemParam,
)
from pydantic import ValidationError

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS, TRIP_REFINER_INSTRUCTIONS
from voyage_ai.ai.schemas import TripPlan
from voyage_ai.ai.tools import (
    EXCHANGE_RATE_TOOL,
    WEATHER_TOOL,
    get_exchange_rate,
    get_weather,
)
from voyage_ai.ai.uploads import UploadedAttachment
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


def build_generation_input(
    request: TripGenerationRequest,
    attachments: list[UploadedAttachment],
) -> list[ResponseInputItemParam]:
    content: list[ResponseInputContentParam] = [
        {
            "type": "input_text",
            "text": request.model_dump_json(),
        }
    ]

    for attachment in attachments:
        encoded_content = base64.b64encode(attachment.content).decode("ascii")

        if attachment.content_type in {"image/jpeg", "image/png"}:
            content.append(
                {
                    "type": "input_image",
                    "image_url": (
                        f"data:{attachment.content_type};base64,{encoded_content}"
                    ),
                    "detail": "auto",
                }
            )
        else:
            content.append(
                {
                    "type": "input_file",
                    "filename": attachment.filename,
                    "file_data": encoded_content,
                }
            )

    return [
        {
            "role": "user",
            "content": content,
        }
    ]


async def generate_trip_plan(
    request: TripGenerationRequest, attachments: list[UploadedAttachment]
) -> TripPlan:
    started_at = time.perf_counter()

    try:
        first_response = await client.responses.parse(
            model="gpt-5.6-luna",
            instructions=TRIP_PLANNER_INSTRUCTIONS,
            input=build_generation_input(request, attachments),
            text_format=TripPlan,
            tools=[WEATHER_TOOL, EXCHANGE_RATE_TOOL],
        )

        responses = [first_response]

        tool_outputs: list[ResponseInputItemParam] = []

        for item in first_response.output:
            if item.type != "function_call":
                continue

            logger.info("AI tool called: name=%s", item.name)

            if item.name == "get_weather":
                arguments = json.loads(item.arguments)
                weather = await get_weather(**arguments)

                tool_outputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(weather),
                    },
                )

            elif item.name == "get_exchange_rate":
                arguments = json.loads(item.arguments)
                exchange_rate = await get_exchange_rate(**arguments)

                tool_outputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(exchange_rate),
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

    except ValidationError as exc:
        logger.exception("OpenAI returned a trip plan that failed Pydantic validation")
        raise RuntimeError("OpenAI returned an invalid trip plan") from exc


async def refine_trip_plan(
    refinement: TripRefinementRequest,
    current_trip_plan: TripPlan,
    original_generation_request: TripGenerationRequest,
) -> TripPlan:
    started_at = time.perf_counter()

    try:
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

    except ValidationError as exc:
        logger.exception(
            "OpenAI returned a refined trip plan that failed Pydantic validation"
        )
        raise RuntimeError("OpenAI returned an invalid refined trip plan") from exc
