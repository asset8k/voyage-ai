from datetime import date
from unittest.mock import AsyncMock

import httpx
import pytest

from voyage_ai.ai.schemas import Activity, BudgetBreakdown, DayPlan, TripPlan
from voyage_ai.places.schemas import ResolvedPlace
from voyage_ai.places.service import (
    GOOGLE_PLACES_TEXT_SEARCH_URL,
    enrich_trip_plan,
    resolve_place,
)


class FakeResponse:
    def __init__(self, data: dict) -> None:
        self._data = data
        self.raise_for_status_called = False

    def raise_for_status(self) -> None:
        self.raise_for_status_called = True

    def json(self) -> dict:
        return self._data


@pytest.mark.asyncio
async def test_resolve_place_maps_google_response(monkeypatch) -> None:
    response = FakeResponse(
        {
            "places": [
                {
                    "id": "ChIJJxwBkr65yhQRrk9EN29vbiM",
                    "displayName": {"text": "Hagia Sophia Grand Mosque"},
                    "formattedAddress": (
                        "Sultan Ahmet, Ayasofya Meydanı No:1, "
                        "34122 Fatih/İstanbul, Türkiye"
                    ),
                    "location": {
                        "latitude": 41.008583,
                        "longitude": 28.980175,
                    },
                },
            ],
        },
    )
    captured_request: dict = {}

    async def fake_post(_client, url, *, headers, json):
        captured_request["url"] = url
        captured_request["headers"] = headers
        captured_request["json"] = json
        return response

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    place = await resolve_place("Hagia Sophia Grand Mosque, Istanbul")

    assert place is not None
    assert place.provider == "google_places"
    assert place.place_id == "ChIJJxwBkr65yhQRrk9EN29vbiM"
    assert place.name == "Hagia Sophia Grand Mosque"
    assert place.latitude == 41.008583
    assert place.longitude == 28.980175
    assert place.photo_reference is None
    assert response.raise_for_status_called
    assert captured_request["url"] == GOOGLE_PLACES_TEXT_SEARCH_URL
    assert captured_request["json"] == {
        "textQuery": "Hagia Sophia Grand Mosque, Istanbul",
        "languageCode": "en",
        "maxResultCount": 1,
    }
    assert captured_request["headers"]["X-Goog-FieldMask"] == (
        "places.id,places.displayName,places.formattedAddress,places.location"
    )


@pytest.mark.asyncio
async def test_resolve_place_returns_none_when_no_match(monkeypatch) -> None:
    async def fake_post(_client, _url, *, headers, json):
        return FakeResponse({"places": []})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    place = await resolve_place("An imaginary place")

    assert place is None


@pytest.mark.asyncio
async def test_resolve_place_returns_none_when_google_fails(monkeypatch) -> None:
    async def fake_post(_client, _url, *, headers, json):
        raise httpx.ConnectError("Unable to connect")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    place = await resolve_place("Hagia Sophia Grand Mosque, Istanbul")

    assert place is None


@pytest.mark.asyncio
async def test_resolve_place_skips_blank_query(monkeypatch) -> None:
    async def fake_post(_client, _url, *, headers, json):
        raise AssertionError("Google Places should not be called")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    place = await resolve_place("   ")

    assert place is None


@pytest.mark.asyncio
async def test_enrich_trip_plan_deduplicates_queries_and_skips_missing_places(
    monkeypatch,
) -> None:
    resolved_place = ResolvedPlace(
        place_id="beijing-cctv",
        name="CCTV Headquarters",
        formatted_address="Beijing, China",
        latitude=39.914,
        longitude=116.456,
    )
    resolver = AsyncMock(side_effect=[resolved_place, None])
    monkeypatch.setattr("voyage_ai.places.service.resolve_place", resolver)

    trip_plan = TripPlan(
        destination="Beijing",
        trip_summary="A short Beijing trip.",
        days=[
            DayPlan(
                day=1,
                date=date(2026, 10, 10),
                title="Modern Beijing",
                activities=[
                    Activity(
                        start_time="09:00",
                        end_time="10:00",
                        name="CCTV Headquarters",
                        description="See the building from the outside.",
                        location="Beijing CBD",
                        map_queries=[
                            "CCTV Headquarters, Beijing",
                            " CCTV Headquarters, Beijing ",
                        ],
                        category="sightseeing",
                        estimated_cost=0,
                    ),
                    Activity(
                        start_time="11:00",
                        end_time="12:00",
                        name="Walk in Beijing CBD",
                        description="Explore the surrounding streets.",
                        location="Beijing CBD",
                        map_queries=[
                            "CCTV Headquarters, Beijing",
                            "Unknown place, Beijing",
                        ],
                        category="walking",
                        estimated_cost=0,
                    ),
                ],
                estimated_daily_cost=1,
            ),
        ],
        budget=BudgetBreakdown(
            accommodation=0,
            food=0,
            transport=0,
            activities=0,
            other=1,
            total=1,
        ),
        recommendations=[],
        warnings=[],
        packing_tips=[],
        assumptions=[],
        currency="USD",
    )

    result = await enrich_trip_plan(trip_plan)

    assert result is trip_plan
    first_activity, second_activity = trip_plan.days[0].activities
    assert first_activity.resolved_places == [resolved_place]
    assert second_activity.resolved_places == [resolved_place]
    assert [call.args[0] for call in resolver.await_args_list] == [
        "CCTV Headquarters, Beijing",
        "Unknown place, Beijing",
    ]
