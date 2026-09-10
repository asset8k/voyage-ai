import base64
import json
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from openai.types.responses import (
    EasyInputMessageParam,
    ResponseInputContentParam,
    ResponseInputFileParam,
    ResponseInputImageParam,
    ResponseInputItemParam,
    ResponseInputTextParam,
)

from voyage_ai.ai import planner
from voyage_ai.ai.planner import build_generation_input, generate_trip_plan
from voyage_ai.ai.schemas import Activity, BudgetBreakdown, DayPlan, TripPlan
from voyage_ai.ai.uploads import UploadedAttachment
from voyage_ai.trips.schemas import TripGenerationRequest


def make_trip_request() -> TripGenerationRequest:
    return TripGenerationRequest(
        destination="Tokyo",
        start_date=date(2026, 10, 10),
        end_date=date(2026, 10, 12),
        budget=Decimal("1000"),
        currency="USD",
        travellers=1,
        travel_pace="balanced",
        preferences="Food and museums",
    )


def make_trip_plan(*, summary: str = "A short Tokyo trip.") -> TripPlan:
    activity = Activity(
        start_time="09:00",
        end_time="10:00",
        name="Breakfast",
        description="Breakfast near the hotel.",
        location="Tokyo",
        category="food",
        estimated_cost=10,
    )
    day = DayPlan(
        day=1,
        date=date(2026, 10, 10),
        title="Arrival day",
        activities=[activity],
        estimated_daily_cost=10,
    )
    budget = BudgetBreakdown(
        accommodation=0,
        food=10,
        transport=0,
        activities=0,
        other=0,
        total=10,
    )
    return TripPlan(
        destination="Tokyo",
        trip_summary=summary,
        days=[day],
        budget=budget,
        recommendations=[],
        warnings=[],
        packing_tips=[],
        assumptions=[],
        currency="USD",
    )


def get_message_content(
    input_items: list[ResponseInputItemParam],
) -> list[ResponseInputContentParam]:
    """Narrow the SDK's broad input-item union to our user message."""
    message = cast(EasyInputMessageParam, input_items[0])
    content = message["content"]
    assert isinstance(content, list)
    return cast(list[ResponseInputContentParam], content)


def make_response(
    *,
    output: list[SimpleNamespace],
    output_parsed: TripPlan | None,
    response_id: str = "response_1",
) -> SimpleNamespace:
    """Create the small part of an OpenAI response used by the planner."""
    return SimpleNamespace(
        id=response_id,
        model="gpt-5.6-luna",
        output=output,
        output_parsed=output_parsed,
        usage=None,
    )


def test_build_generation_input_without_attachments() -> None:
    input_items = build_generation_input(make_trip_request(), [])

    assert len(input_items) == 1
    content = get_message_content(input_items)
    text_part = cast(ResponseInputTextParam, content[0])
    assert len(content) == 1
    assert text_part["type"] == "input_text"
    assert json.loads(text_part["text"])["destination"] == "Tokyo"


def test_build_generation_input_encodes_images_and_pdfs() -> None:
    image_content = b"\xff\xd8\xffimage-content"
    pdf_content = b"%PDF-1.7 pdf-content"
    attachments = [
        UploadedAttachment(
            filename="hotel.jpg",
            content_type="image/jpeg",
            content=image_content,
        ),
        UploadedAttachment(
            filename="booking.pdf",
            content_type="application/pdf",
            content=pdf_content,
        ),
    ]

    content = get_message_content(
        build_generation_input(make_trip_request(), attachments),
    )
    image_part = cast(ResponseInputImageParam, content[1])
    pdf_part = cast(ResponseInputFileParam, content[2])

    assert image_part == {
        "type": "input_image",
        "image_url": (
            "data:image/jpeg;base64,"
            f"{base64.b64encode(image_content).decode('ascii')}"
        ),
        "detail": "auto",
    }
    assert pdf_part == {
        "type": "input_file",
        "filename": "booking.pdf",
        "file_data": base64.b64encode(pdf_content).decode("ascii"),
    }


@pytest.mark.asyncio
async def test_generate_trip_plan_returns_first_response_without_tool_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trip_plan = make_trip_plan()
    parse = AsyncMock(
        return_value=make_response(output=[], output_parsed=trip_plan),
    )
    monkeypatch.setattr(planner.client.responses, "parse", parse)

    result = await generate_trip_plan(make_trip_request(), [])

    assert result is trip_plan
    parse.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_trip_plan_continues_after_weather_and_currency_tools(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_call = SimpleNamespace(
        type="function_call",
        name="get_weather",
        arguments=json.dumps({"destination": "Tokyo", "date": "2026-10-10"}),
        call_id="weather_call_1",
    )
    exchange_rate_call = SimpleNamespace(
        type="function_call",
        name="get_exchange_rate",
        arguments=json.dumps({"base_currency": "USD", "quote_currency": "JPY"}),
        call_id="exchange_rate_call_1",
    )
    first_response = make_response(
        output=[weather_call, exchange_rate_call],
        output_parsed=None,
        response_id="response_with_tools",
    )
    final_trip_plan = make_trip_plan(summary="A tool-informed Tokyo trip.")
    final_response = make_response(
        output=[],
        output_parsed=final_trip_plan,
        response_id="final_response",
    )
    parse = AsyncMock(side_effect=[first_response, final_response])
    get_weather = AsyncMock(return_value={"available": True, "conditions": "Clear"})
    get_exchange_rate = AsyncMock(return_value={"available": True, "rate": 150})

    monkeypatch.setattr(planner.client.responses, "parse", parse)
    monkeypatch.setattr(planner, "get_weather", get_weather)
    monkeypatch.setattr(planner, "get_exchange_rate", get_exchange_rate)

    result = await generate_trip_plan(make_trip_request(), [])

    assert result is final_trip_plan
    get_weather.assert_awaited_once_with(destination="Tokyo", date="2026-10-10")
    get_exchange_rate.assert_awaited_once_with(
        base_currency="USD",
        quote_currency="JPY",
    )
    assert parse.await_count == 2

    final_call = parse.await_args_list[1]
    assert final_call.kwargs["previous_response_id"] == "response_with_tools"
    assert final_call.kwargs["input"] == [
        {
            "type": "function_call_output",
            "call_id": "weather_call_1",
            "output": json.dumps({"available": True, "conditions": "Clear"}),
        },
        {
            "type": "function_call_output",
            "call_id": "exchange_rate_call_1",
            "output": json.dumps({"available": True, "rate": 150}),
        },
    ]


@pytest.mark.asyncio
async def test_generate_trip_plan_raises_when_no_structured_plan_is_returned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    parse = AsyncMock(
        return_value=make_response(output=[], output_parsed=None),
    )
    monkeypatch.setattr(planner.client.responses, "parse", parse)

    with pytest.raises(RuntimeError, match="no structured trip plan"):
        await generate_trip_plan(make_trip_request(), [])
