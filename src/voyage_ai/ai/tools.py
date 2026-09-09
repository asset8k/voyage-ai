from openai.types.responses import FunctionToolParam

WEATHER_TOOL: FunctionToolParam = {
    "type": "function",
    "name": "get_weather",
    "description": "Get weather conditions for a destination and date.",
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


async def get_weather(destination: str, date: str) -> dict:
    return {
        "destination": destination,
        "date": date,
        "temperature_celsius": 5,
        "conditions": "Cold and rainy weather",
        "source": "mock",
    }
