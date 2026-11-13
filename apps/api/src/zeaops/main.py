import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from zeaops.database import SCHEMA_REVISION, BootstrapMetadata, create_database_engine
from zeaops.errors import error_response, http_error, unexpected_error, validation_error
from zeaops.observability import CorrelationMiddleware, configure_logging, logger
from zeaops.settings import Settings

READINESS_TIMEOUT_SECONDS = 4.0
SHUTDOWN_TIMEOUT_SECONDS = 5.0


class Health(BaseModel):
    status: Literal["ok", "ready"]
    service: Literal["zeaops-api"] = "zeaops-api"


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    config = settings or Settings()
    configure_logging(config.log_level)
    db = engine if engine is not None else create_database_engine(config)
    probe_task: asyncio.Task[str] | None = None

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        logger.info("application_started")
        try:
            yield
        finally:
            try:
                if probe_task is not None:
                    try:
                        await asyncio.wait_for(
                            asyncio.shield(probe_task), timeout=SHUTDOWN_TIMEOUT_SECONDS
                        )
                    except TimeoutError:
                        probe_task.cancel()
                        logger.warning("database_probe_shutdown_timeout")
                    except Exception:
                        logger.error("database_probe_shutdown_failed")
            finally:
                db.dispose()
                logger.info("application_stopped")

    app = FastAPI(
        title="ZeaOPS API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if config.environment == "development" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if config.environment == "development" else None,
    )
    app.state.engine = db
    app.add_exception_handler(HTTPException, http_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unexpected_error)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.allowed_hosts)
    app.add_middleware(CorrelationMiddleware)

    @app.get("/health/live", response_model=Health, tags=["health"])
    def live() -> Health:
        return Health(status="ok")

    def probe_database() -> str:
        try:
            with db.connect() as connection:
                connection.execute(text("SELECT 1"))
                revision = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
                connection.execute(select(BootstrapMetadata.id).limit(1))
                if revision != SCHEMA_REVISION:
                    return "Metadata schema is not ready"
        except SQLAlchemyError:
            logger.warning("database_readiness_failed")
            return "Metadata database is not ready"
        return "ready"

    @app.get(
        "/health/ready",
        response_model=Health,
        responses={503: {"description": "Metadata database or schema unavailable"}},
        tags=["health"],
    )
    async def ready(request: Request) -> Health | JSONResponse:
        nonlocal probe_task
        # DNS resolution can exceed libpq's connect_timeout. Bound the HTTP response while
        # sharing one in-flight worker so repeated probes cannot create unbounded threads.
        if probe_task is None or probe_task.done():
            probe_task = asyncio.create_task(asyncio.to_thread(probe_database))
        try:
            result = await asyncio.wait_for(
                asyncio.shield(probe_task), timeout=READINESS_TIMEOUT_SECONDS
            )
        except TimeoutError:
            result = "Metadata database is not ready"
        if result != "ready":
            return error_response(request, 503, "not_ready", result)
        return Health(status="ready")

    return app
