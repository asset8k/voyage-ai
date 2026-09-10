import logging

import httpx

from voyage_ai.ai.schemas import TripPlan
from voyage_ai.config import settings
from voyage_ai.places.schemas import ResolvedPlace

logger = logging.getLogger(__name__)

GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


async def resolve_place(query: str) -> ResolvedPlace | None:

    if not query.strip():
        return None

    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key.get_secret_value(),
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,places.location"
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                GOOGLE_PLACES_TEXT_SEARCH_URL,
                headers=headers,
                json={
                    "textQuery": query,
                    "languageCode": "en",
                    "maxResultCount": 1,
                },
            )
            response.raise_for_status()

        places = response.json().get("places", [])

    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Google Places lookup failed for %r: %s", query, exc)
        return None

    if not places:
        return None

    place = places[0]
    place_id = place.get("id")
    name = place.get("displayName", {}).get("text")
    location = place.get("location", {})

    latitude = location.get("latitude")
    longitude = location.get("longitude")

    if not place_id or not name or latitude is None or longitude is None:
        logger.warning("Google Places returned incomplete data for %r", query)
        return None

    return ResolvedPlace(
        place_id=place_id,
        name=name,
        formatted_address=place.get("formattedAddress"),
        latitude=latitude,
        longitude=longitude,
    )


async def enrich_trip_plan(trip_plan: TripPlan) -> TripPlan:
    resolved_by_query: dict[str, ResolvedPlace | None] = {}

    for day in trip_plan.days:
        for activity in day.activities:
            activity.resolved_places = []
            activity_queries: set[str] = set()

            for query in activity.map_queries:
                cache_key = query.strip().casefold()

                if not cache_key or cache_key in activity_queries:
                    continue

                activity_queries.add(cache_key)

                if cache_key not in resolved_by_query:
                    resolved_by_query[cache_key] = await resolve_place(query)

                resolved_place = resolved_by_query[cache_key]

                if resolved_place is not None:
                    activity.resolved_places.append(resolved_place)

    return trip_plan
