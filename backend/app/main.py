from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router, ws_router
from app.api.schemas import HealthResponse
from app.services.runtime import ApplicationRuntime


def _allowed_origins() -> list[str]:
    configured = os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(
    title="VoltFlow Smart EV Charging Backend",
    version="1.0.0",
    description="Authoritative virtual charging cluster, optimization, and integration API.",
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
