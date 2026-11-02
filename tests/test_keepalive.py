import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import SecretStr
from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError

from voyage_ai import internal
from voyage_ai.config import settings

TOKEN = "test-monitor-token"
HEADERS = {"X-Keepalive-Token": TOKEN}


@pytest.fixture(autouse=True)
def monitoring_token(monkeypatch):
    monkeypatch.setattr(settings, "keepalive_token", SecretStr(TOKEN))


def test_keepalive_executes_real_database_query(client, monkeypatch):
    # Use the isolated PostgreSQL test engine, never the production database.
    from conftest import test_engine

    monkeypatch.setattr(internal, "engine", test_engine)
    statements = []

    def record_query(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(test_engine.sync_engine, "before_cursor_execute", record_query)
    try:
        response = client.get("/internal/keepalive", headers=HEADERS)
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", record_query)

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
    assert response.headers["cache-control"] == "no-store"
    assert "SELECT 1 /* voyage_keepalive */" in statements


@pytest.mark.parametrize("headers", [{}, {"X-Keepalive-Token": "wrong"}])
def test_keepalive_rejects_unauthorized_requests_without_querying(client, monkeypatch, headers):
    check = AsyncMock()
    monkeypatch.setattr(internal, "check_database", check)
    response = client.get("/internal/keepalive", headers=headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    check.assert_not_awaited()


def test_keepalive_disabled_when_token_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "keepalive_token", SecretStr(""))
    check = AsyncMock()
    monkeypatch.setattr(internal, "check_database", check)
    assert client.get("/internal/keepalive", headers=HEADERS).status_code == 403
    check.assert_not_awaited()


@pytest.mark.parametrize("failure", [OSError("private-host"), SQLAlchemyError("private-password")])
def test_keepalive_hides_database_failures(client, monkeypatch, caplog, failure):
    connection = AsyncMock()
    connection.execute.side_effect = failure
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=connection)
    context.__aexit__ = AsyncMock(return_value=False)
    engine = MagicMock()
    engine.connect.return_value = context
    monkeypatch.setattr(internal, "engine", engine)

    response = client.get("/internal/keepalive", headers=HEADERS)
    assert response.status_code == 503
    assert response.json() == {"detail": "Service temporarily unavailable"}
    assert response.headers["cache-control"] == "no-store"
    assert str(failure) not in response.text
    assert str(failure) not in caplog.text
    context.__aexit__.assert_awaited_once()


@pytest.mark.parametrize("stall_at", ["connect", "query"])
def test_keepalive_times_out_during_connection_or_query(client, monkeypatch, stall_at):
    async def stall(*_args, **_kwargs):
        await asyncio.sleep(60)

    connection = AsyncMock()
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=connection)
    context.__aexit__ = AsyncMock(return_value=False)
    if stall_at == "connect":
        context.__aenter__.side_effect = stall
    else:
        connection.execute.side_effect = stall
    engine = MagicMock()
    engine.connect.return_value = context
    monkeypatch.setattr(internal, "engine", engine)
    monkeypatch.setattr(internal, "KEEPALIVE_TIMEOUT_SECONDS", 0.01)

    response = client.get("/internal/keepalive", headers=HEADERS)
    assert response.status_code == 503
    assert response.json() == {"detail": "Service temporarily unavailable"}


def test_liveness_stays_public_and_does_not_query_database(client, monkeypatch):
    check = AsyncMock()
    monkeypatch.setattr(internal, "check_database", check)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    check.assert_not_awaited()


def test_keepalive_is_not_in_public_openapi(client):
    assert "/internal/keepalive" not in client.get("/openapi.json").json()["paths"]
