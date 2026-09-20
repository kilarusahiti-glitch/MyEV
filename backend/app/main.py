from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import _status, router, ws_router
from app.api.schemas import HealthResponse
from app.services.runtime import ApplicationRuntime


def _allowed_origins() -> list[str]:
    configured = os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:8081",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def _firebase_sync_interval() -> float:
    try:
        return max(5.0, float(os.getenv("FIREBASE_SYNC_INTERVAL_SECONDS", "7")))
    except ValueError:
        return 7.0


async def _firebase_sync_loop() -> None:
    while True:
        await asyncio.sleep(_firebase_sync_interval())
        try:
            changed = await asyncio.to_thread(runtime.sync_firebase_vehicles)
            if changed:
                await runtime.websocket_manager.broadcast("vehicles_updated", _status(runtime))
        except asyncio.CancelledError:
            raise
        except Exception:
            # Firebase is secondary persistence; the main control loop remains alive.
            continue


async def _charger_health_sample_loop() -> None:
    while True:
        await asyncio.sleep(3600)
        try:
            await asyncio.to_thread(runtime.record_charger_health_sample)
        except asyncio.CancelledError:
            raise
        except Exception:
            continue


@asynccontextmanager
async def lifespan(_app: FastAPI):
    tasks = [
        asyncio.create_task(_firebase_sync_loop()),
        asyncio.create_task(_charger_health_sample_loop()),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(
    title="VoltFlow Smart EV Charging Backend",
    version="1.0.0",
    description="Authoritative virtual charging cluster, optimization, and integration API.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
runtime = ApplicationRuntime()
app.include_router(router)
app.include_router(ws_router)


@app.get("/health", response_model=HealthResponse, summary="Check backend availability")
def health() -> HealthResponse:
    return HealthResponse(status="ok")
