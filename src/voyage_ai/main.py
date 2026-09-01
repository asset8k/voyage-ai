from contextlib import asynccontextmanager

from fastapi import FastAPI

from voyage_ai.auth.router import router as auth_router
from voyage_ai.database import engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(lifespan=lifespan)

app.include_router(auth_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
