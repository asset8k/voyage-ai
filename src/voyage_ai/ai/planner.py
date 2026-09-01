from openai import AsyncOpenAI

from voyage_ai.ai.prompts import TRIP_PLANNER_INSTRUCTIONS
from voyage_ai.config import settings

client = AsyncOpenAI(
    api_key=settings.openai_api_key.get_secret_value(),
)


async def generate_trip_draft(user_request: str) -> str:
    response = await client.responses.create(
        model="gpt-5.6-luna",
        instructions=TRIP_PLANNER_INSTRUCTIONS,
        input=user_request,
    )
    return response.output_text


if __name__ == "__main__":
    import asyncio

    result = asyncio.run(
        generate_trip_draft(
            "Destination: Japan, Budget: $5000, People: 3",
        )
    )
    print(result)
