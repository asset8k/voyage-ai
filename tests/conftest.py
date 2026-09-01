import asyncio
from collections.abc import AsyncGenerator, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from voyage_ai.config import settings
from voyage_ai.database import Base, get_db
from voyage_ai.main import app

if not settings.test_database_url:
    raise RuntimeError("TEST_DATABASE_URL must be configured for tests.")


test_engine = create_async_engine(
    settings.test_database_url,
    poolclass=NullPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    async def setup() -> None:
        async with test_engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

    async def teardown() -> None:
        async with test_engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await test_engine.dispose()

    asyncio.run(setup())
    yield
    asyncio.run(teardown())


@pytest.fixture(autouse=True)
def clean_database() -> Generator[None, None, None]:
    async def clean() -> None:
        async with TestSessionLocal() as session:
            await session.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE"))
            await session.commit()

    asyncio.run(clean())
    yield


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
