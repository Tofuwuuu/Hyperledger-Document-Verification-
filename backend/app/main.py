from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import mongo_ping
from app.api.register import router as register_router


app = FastAPI(title="CVSU Alumni Verification API", version="0.1.0")


if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/api/v1/healthcheck/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/v1/healthcheck/health/db")
async def health_db() -> dict:
    up = await mongo_ping()
    return {"status": "ok" if up else "down", "mongo": {"up": up}}


@app.get("/api/v1/healthcheck/health/alumni")
def health_alumni() -> dict:
    # Placeholder for the alumni service health (kept under the same healthcheck prefix).
    return {"status": "ok", "alumni": "placeholder"}


app.include_router(register_router, prefix="/api/v1")

