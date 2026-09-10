import httpx
from openai.types.responses import FunctionToolParam

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CURRENCY_RATE_URL = "https://api.frankfurter.dev/v2/rate"

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
                "description": "City name only, for example Prague or Astana. Do not include a country.",
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

EXCHANGE_RATE_TOOL: FunctionToolParam = {
    "type": "function",
    "name": "get_exchange_rate",
    "description": (
        "Get the latest exchange rate between two ISO 4217 currencies. "
        "Use this when the trip budget currency differs from the destination's "
        "local currency, or when the user explicitly asks for a currency conversion. "
        "The returned rate is current and indicative, not a guaranteed future rate."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "base_currency": {
                "type": "string",
                "description": (
                    "The currency being converted from as a three-letter ISO 4217 "
                    "code, for example USD."
                ),
            },
            "quote_currency": {
                "type": "string",
                "description": (
                    "The currency being converted to as a three-letter ISO 4217 "
                    "code, for example KZT."
                ),
            },
        },
        "required": ["base_currency", "quote_currency"],
        "additionalProperties": False,
    },
    "strict": True,
}


async def get_coordinates(
    client: httpx.AsyncClient,
    destination: str,
) -> tuple[float, float] | None:
    city = destination.split(",", maxsplit=1)[0].strip()

    response = await client.get(
        GEOCODING_URL,
        params={"name": city, "count": 1, "language": "en"},
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


async def get_exchange_rate(base_currency: str, quote_currency: str) -> dict:
    base_currency = base_currency.upper()
    quote_currency = quote_currency.upper()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{CURRENCY_RATE_URL}/{base_currency}/{quote_currency}"
            )
            response.raise_for_status()

        data = response.json()

        return {
            "base_currency": base_currency,
            "quote_currency": quote_currency,
            "available": True,
            "rate": data["rate"],
            "date": ["date"],
            "source": "frankfurter",
        }

    except httpx.HTTPError:
        return {
            "base_currency": base_currency,
            "quote_currency": quote_currency,
            "available": False,
            "reason": "Currency exchange service is temporarily unavailable",
            "source": "frankfurter",
        }
