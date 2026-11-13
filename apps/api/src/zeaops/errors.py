from collections.abc import Mapping

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from zeaops.observability import logger


def error_response(
    request: Request, status: int, code: str, message: str, headers: Mapping[str, str] | None = None
) -> JSONResponse:
    request_id = getattr(request.state, "correlation_id", "")
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "correlation_id": request_id}},
        headers={
            **(headers or {}),
            "X-Correlation-ID": request_id,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    message = "An unexpected error occurred" if exc.status_code >= 500 else str(exc.detail)
    return error_response(request, exc.status_code, "http_error", message, exc.headers)


async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(request, 422, "validation_error", "Request validation failed")


async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Do not log raw exceptions: database exceptions can contain connection credentials.
    logger.error("unhandled_exception")
    return error_response(request, 500, "internal_error", "An unexpected error occurred")
