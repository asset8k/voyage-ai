from datetime import date
from unittest.mock import AsyncMock

import pytest

from voyage_ai.ai.schemas import Activity, BudgetBreakdown, DayPlan, TripPlan


def authenticate_user(client, username: str) -> dict[str, str]:
    """Register a test user and return its bearer-auth header."""
    credentials = {
        "username": username,
        "password": "securepassword123",
    }

    register_response = client.post("/api/auth/register", json=credentials)
    assert register_response.status_code == 201

    login_response = client.post("/api/auth/login", json=credentials)
    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def create_saved_trip(client, headers: dict[str, str], payload: dict) -> dict:
    """Create a trip through the API and return its response body."""
    response = client.post("/api/trips", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


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
        accommodation=0,
        food=10,
        transport=0,
        activities=0,
        other=0,
        total=10,
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


@pytest.fixture
def owner_headers(client) -> dict[str, str]:
    return authenticate_user(client, "trip_owner")


@pytest.fixture
def other_user_headers(client) -> dict[str, str]:
    return authenticate_user(client, "other_user")


@pytest.fixture
def saved_trip_payload(sample_trip_request, sample_trip_plan) -> dict:
    return {
        "title": "Tokyo food weekend",
        "generation_request": sample_trip_request,
        "trip_plan": sample_trip_plan.model_dump(mode="json"),
    }


def test_generate_trip(
    client,
    sample_trip_request,
    sample_trip_plan,
    monkeypatch,
):
    mock_planner = AsyncMock(return_value=sample_trip_plan)

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_service",
        mock_planner,
    )

    response = client.post("/api/trips/generate", data=sample_trip_request)

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
        "voyage_ai.trips.router.generate_trip_service",
        mock_planner,
    )

    response = client.post(
        "/api/trips/generate",
        data={**sample_trip_request, "budget": 0},
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
        "voyage_ai.trips.router.generate_trip_service",
        mock_planner,
    )

    response = client.post("/api/trips/generate", data=sample_trip_request)

    assert response.status_code == 502
    assert (
        response.json()["detail"] == "Unable to generate a trip plan. Please try again."
    )
    mock_planner.assert_awaited_once()


def test_generate_trip_forwards_valid_attachment(
    client,
    sample_trip_request,
    sample_trip_plan,
    monkeypatch,
):
    mock_planner = AsyncMock(return_value=sample_trip_plan)

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_service",
        mock_planner,
    )

    response = client.post(
        "/api/trips/generate",
        data=sample_trip_request,
        files={
            "files": (
                "hotel.jpg",
                b"\xff\xd8\xffimage-content",
                "image/jpeg",
            ),
        },
    )

    assert response.status_code == 200
    mock_planner.assert_awaited_once()

    assert mock_planner.await_args is not None
    request, attachments = mock_planner.await_args.args
    assert request.destination == "Tokyo"
    assert len(attachments) == 1
    assert attachments[0].filename == "hotel.jpg"
    assert attachments[0].content_type == "image/jpeg"
    assert attachments[0].content == b"\xff\xd8\xffimage-content"


def test_generate_trip_rejects_invalid_date_range(
    client,
    sample_trip_request,
    monkeypatch,
):
    mock_planner = AsyncMock()

    monkeypatch.setattr(
        "voyage_ai.trips.router.generate_trip_service",
        mock_planner,
    )

    response = client.post(
        "/api/trips/generate",
        data={**sample_trip_request, "end_date": "2026-10-10"},
    )

    assert response.status_code == 422
    mock_planner.assert_not_awaited()


def test_public_trip_appears_in_feed(client, owner_headers, saved_trip_payload):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    publish_response = client.patch(
        f"/api/trips/{trip['id']}",
        json={"is_public": True},
        headers=owner_headers,
    )
    assert publish_response.status_code == 200

    response = client.get("/api/trips/feed")

    assert response.status_code == 200
    feed_trip = next(item for item in response.json() if item["id"] == trip["id"])
    assert feed_trip["title"] == "Tokyo food weekend"
    assert feed_trip["trip_summary"] == "A short Tokyo trip."
    assert feed_trip["author"]["username"] == "trip_owner"


def test_private_trip_does_not_appear_in_feed(
    client,
    owner_headers,
    saved_trip_payload,
):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    response = client.get("/api/trips/feed")

    assert response.status_code == 200
    assert all(item["id"] != trip["id"] for item in response.json())


def test_guest_can_view_public_trip(client, owner_headers, saved_trip_payload):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)
    publish_response = client.patch(
        f"/api/trips/{trip['id']}",
        json={"is_public": True},
        headers=owner_headers,
    )
    assert publish_response.status_code == 200

    response = client.get(f"/api/trips/{trip['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == trip["id"]


def test_guest_cannot_view_private_trip(client, owner_headers, saved_trip_payload):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    response = client.get(f"/api/trips/{trip['id']}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_owner_can_view_own_private_trip(client, owner_headers, saved_trip_payload):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    response = client.get(
        f"/api/trips/{trip['id']}",
        headers=owner_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == trip["id"]


def test_other_user_cannot_update_or_delete_trip(
    client,
    owner_headers,
    other_user_headers,
    saved_trip_payload,
):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    update_response = client.patch(
        f"/api/trips/{trip['id']}",
        json={"title": "Unauthorized change"},
        headers=other_user_headers,
    )
    delete_response = client.delete(
        f"/api/trips/{trip['id']}",
        headers=other_user_headers,
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404


def test_owner_can_update_and_delete_trip(client, owner_headers, saved_trip_payload):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    update_response = client.patch(
        f"/api/trips/{trip['id']}",
        json={"title": "Tokyo food journey", "is_public": True},
        headers=owner_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Tokyo food journey"
    assert update_response.json()["is_public"] is True

    delete_response = client.delete(
        f"/api/trips/{trip['id']}",
        headers=owner_headers,
    )

    assert delete_response.status_code == 204

    get_response = client.get(
        f"/api/trips/{trip['id']}",
        headers=owner_headers,
    )
    assert get_response.status_code == 404


def test_owner_can_refine_saved_trip(
    client,
    owner_headers,
    saved_trip_payload,
    sample_trip_plan,
    monkeypatch,
):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)
    refined_plan = sample_trip_plan.model_copy(
        update={"trip_summary": "A more relaxed Tokyo trip."},
    )
    mock_refiner = AsyncMock(return_value=refined_plan)
    mock_enricher = AsyncMock(return_value=refined_plan)

    monkeypatch.setattr(
        "voyage_ai.trips.service.refine_trip_plan",
        mock_refiner,
    )
    monkeypatch.setattr(
        "voyage_ai.trips.service.enrich_trip_plan",
        mock_enricher,
    )

    response = client.post(
        f"/api/trips/{trip['id']}/refine",
        json={"instruction": "Make the itinerary more relaxed."},
        headers=owner_headers,
    )

    assert response.status_code == 200
    assert response.json()["trip_plan"]["trip_summary"] == "A more relaxed Tokyo trip."
    mock_refiner.assert_awaited_once()
    mock_enricher.assert_awaited_once_with(refined_plan)


def test_other_user_cannot_refine_trip(
    client,
    owner_headers,
    other_user_headers,
    saved_trip_payload,
):
    trip = create_saved_trip(client, owner_headers, saved_trip_payload)

    response = client.post(
        f"/api/trips/{trip['id']}/refine",
        json={"instruction": "Make the itinerary more relaxed."},
        headers=other_user_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"
