from typing import Any
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.register import router as register_router
from app.api.endpoints.verification import router as verification_router


app = FastAPI(title="CVSU Alumni Verification API", version="0.1.0")


if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(register_router, prefix="/api/v1")
app.include_router(verification_router, prefix="/api/v1")

logger = logging.getLogger("backend")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error("Request validation failed for %s: %s", request.url.path, exc.errors())
    logger.error("Request body: %s", body.decode("utf-8", errors="replace"))
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


def custom_openapi() -> dict[str, Any]:
    """Serve OpenAPI 3.0.2 so Swagger UI and older clients accept the document."""
    if app.openapi_schema is None:
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
    return app.openapi_schema


app.openapi = custom_openapi

