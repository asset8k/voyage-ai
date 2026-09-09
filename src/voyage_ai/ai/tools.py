import httpx
from openai.types.responses import FunctionToolParam

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WMO_WEATHER_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

WEATHER_TOOL: FunctionToolParam = {
    "type": "function",
    "name": "get_weather",
    "description": (
        "Get a daily weather forecast for a destination and date. "
        "Forecasts may be unavailable for dates more than 16 days ahead."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "destination": {
                "type": "string",
                "description": "City and country, for example Astana, Kazakhstan.",
            },
            "date": {
                "type": "string",
                "format": "date",
                "description": "Date in YYYY-MM-DD format.",
            },
        },
        "required": ["destination", "date"],
        "additionalProperties": False,
    },
    "strict": True,
}


async def get_coordinates(
    client: httpx.AsyncClient,
    destination: str,
) -> tuple[float, float] | None:
    response = await client.get(
        GEOCODING_URL, params={"name": destination, "count": 1, "language": "en"}
    )
    response.raise_for_status()

    results = response.json().get("results", [])

    if not results:
        return None

    best_match = results[0]

    return best_match["latitude"], best_match["longitude"]


async def get_weather(destination: str, date: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            coordinates = await get_coordinates(client, destination)

            if coordinates is None:
                return {
                    "destination": destination,
                    "date": date,
                    "available": False,
                    "reason": "Destination could not be found",
                    "source": "open-meteo",
                }

            latitude, longitude = coordinates

            response = await client.get(
                FORECAST_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "daily": (
                        "temperature_2m_min",
                        "temperature_2m_max",
                        "precipitation_probability_max",
                        "weather_code",
                    ),
                    "timezone": "auto",
                    "forecast_days": 16,
                },
            )
            response.raise_for_status()

        daily = response.json()["daily"]

        if date not in daily["time"]:
            return {
                "destination": destination,
                "date": date,
                "available": False,
                "reason": "Forecast unavailable for this date",
                "source": "open-meteo",
            }

        index = daily["time"].index(date)
        weather_code = daily["weather_code"][index]

        return {
            "destination": destination,
            "date": date,
            "available": True,
            "temperature_min_celsius": daily["temperature_2m_min"][index],
            "temperature_max_celsius": daily["temperature_2m_max"][index],
            "precipitation_probability": (
                daily["precipitation_probability_max"][index]
            ),
            "conditions": WMO_WEATHER_CODES.get(
                weather_code,
                "Unknown weather conditions",
            ),
            "weather_code": daily["weather_code"][index],
            "source": "open-meteo",
        }

    except httpx.HTTPError:
        return {
            "destination": destination,
            "date": date,
            "available": False,
            "reason": "Weather service is temporarily unavailable",
            "source": "open-meteo",
        }
