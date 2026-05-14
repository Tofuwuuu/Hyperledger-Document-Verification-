from typing import Any
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.alumni import router as alumni_router
from app.api.endpoints.document_requests import router as document_requests_router
from app.api.endpoints.documents import router as documents_router
from app.api.endpoints.events import router as events_router
from app.api.endpoints.references import router as references_router
from app.api.endpoints.registrations import router as registrations_router
from app.api.endpoints.verification import router as verification_router
from app.api.register import router as register_router
from app.api.endpoints.stubs import router as stubs_router
from app.api.endpoints.admin_roles import router as admin_roles_router
from app.api.endpoints.notifications import router as notifications_router
from app.api.endpoints.meetings import router as meetings_router
from app.api.endpoints.auth_password import router as auth_password_router
from app.config import settings
from app.db.bootstrap import initialize_database


logger = logging.getLogger("backend")


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    await initialize_database()
    try:
        _app.openapi()
        logger.info("OpenAPI schema ready (see /docs and /openapi.json)")
    except Exception:
        logger.exception(
            "OpenAPI schema generation failed at startup; /docs and /openapi.json may still error until this is fixed"
        )
    yield


app = FastAPI(
    title="CVSU Alumni Verification API",
    version="0.1.0",
    lifespan=_lifespan,
)


if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition", "Content-Type"],
    )
    logger.info("CORS enabled. Allowed origins: %s", settings.cors_origins_list)


app.include_router(register_router, prefix="/api/v1")
app.include_router(alumni_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(document_requests_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(registrations_router, prefix="/api/v1")
app.include_router(references_router, prefix="/api/v1")
app.include_router(verification_router, prefix="/api/v1")
app.include_router(stubs_router, prefix="/api/v1")
app.include_router(admin_roles_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(meetings_router, prefix="/api/v1")
app.include_router(auth_password_router, prefix="/api/v1")


@app.get("/health")
async def root_health() -> dict[str, str]:
    """Lightweight health check (no DB); use to confirm the ASGI app is running."""
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error("Request validation failed for %s: %s", request.url.path, exc.errors())
    logger.error("Request body: %s", body.decode("utf-8", errors="replace"))
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


def custom_openapi() -> dict[str, Any]:
    """Serve OpenAPI 3.0.2 so Swagger UI and older clients accept the document."""
    if app.openapi_schema is None:
        try:
            app.openapi_schema = get_openapi(
                title=app.title,
                version=app.version,
                openapi_version="3.0.2",
                summary=app.summary,
                description=app.description,
                routes=app.routes,
                webhooks=app.webhooks.routes,
                tags=app.openapi_tags,
                servers=app.servers,
                terms_of_service=app.terms_of_service,
                contact=app.contact,
                license_info=app.license_info,
                separate_input_output_schemas=app.separate_input_output_schemas,
                external_docs=app.openapi_external_docs,
            )
        except Exception:
            logger.exception(
                "OpenAPI 3.0.2 generation failed; retrying with OpenAPI 3.1 defaults"
            )
            app.openapi_schema = get_openapi(
                title=app.title,
                version=app.version,
                routes=app.routes,
                webhooks=app.webhooks.routes,
            )
    return app.openapi_schema


app.openapi = custom_openapi
