from datetime import date
from unittest.mock import AsyncMock

import pytest

from voyage_ai.ai.schemas import Activity, BudgetBreakdown, DayPlan, TripPlan


@pytest.fixture
def sample_trip_request() -> dict:
    return {
        "destination": "Tokyo",
        "start_date": "2026-10-10",
        "end_date": "2026-10-12",
        "budget": 1000,
        "currency": "USD",
        "travellers": 1,
        "travel_pace": "balanced",
        "preferences": "Food and museums",
    }


@pytest.fixture
def sample_trip_plan() -> TripPlan:
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
        accommodation=500,
        food=200,
        transport=100,
        activities=100,
        other=100,
        total=1000,
    )

    return TripPlan(
        destination="Tokyo",
        trip_summary="A short Tokyo trip.",
        days=[day],
        budget=budget,
        recommendations=[],
        warnings=[],
        packing_tips=[],
        assumptions=[],
        currency="USD",
    )


def test_generate_trip(
    client,
    sample_trip_request,
    sample_trip_plan,
    monkeypatch,
):
    mock_planner = AsyncMock(return_value=sample_trip_plan)

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_plan",
        mock_planner,
    )

    response = client.post("/api/trips/generate", json=sample_trip_request)

    assert response.status_code == 200
    assert response.json()["destination"] == "Tokyo"
    mock_planner.assert_awaited_once()


def test_generate_trip_invalid_request(
    client,
    sample_trip_request,
    monkeypatch,
):
    mock_planner = AsyncMock()

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_plan",
        mock_planner,
    )

    response = client.post(
        "/api/trips/generate",
        json={**sample_trip_request, "budget": 0},
    )

    assert response.status_code == 422
    mock_planner.assert_not_awaited()


def test_generate_trip_runtime_error(
    client,
    sample_trip_request,
    monkeypatch,
):
    mock_planner = AsyncMock(
        side_effect=RuntimeError("OpenAI returned no structured trip plan")
    )

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_plan",
        mock_planner,
    )

    response = client.post("/api/trips/generate", json=sample_trip_request)

    assert response.status_code == 502
    assert (
        response.json()["detail"] == "Unable to generate a trip plan. Please try again."
    )
    mock_planner.assert_awaited_once()
