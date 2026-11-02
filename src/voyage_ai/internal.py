"""Authenticated readiness monitoring through the application's database engine."""

import asyncio
import logging
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from voyage_ai.config import settings
from voyage_ai.database import engine

logger = logging.getLogger(__name__)
router = APIRouter()
KEEPALIVE_TIMEOUT_SECONDS = 5


async def check_database() -> None:
    # Include pool checkout, connection establishment, query and release in the limit.
    async with asyncio.timeout(KEEPALIVE_TIMEOUT_SECONDS):
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1 /* voyage_keepalive */"))


@router.get("/internal/keepalive", include_in_schema=False)
async def keepalive(
    response: Response,
    token: Annotated[str | None, Header(alias="X-Keepalive-Token")] = None,
) -> dict[str, str]:
    expected = settings.keepalive_token.get_secret_value()
    if not expected or token is None or not secrets.compare_digest(
        token.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
            headers={"Cache-Control": "no-store"},
        )

    started_at = time.perf_counter()
    try:
        await check_database()
    except (TimeoutError, SQLAlchemyError, OSError) as exc:
        # Database exception messages may contain connection details; log only the type.
        logger.warning("Keepalive failed: reason=%s", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
            headers={"Cache-Control": "no-store"},
        ) from None

    logger.info(
        "Keepalive succeeded: database=ok latency_ms=%.0f",
        (time.perf_counter() - started_at) * 1000,
    )
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok", "database": "ok"}
