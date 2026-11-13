import json
import logging
import re
import time
from contextvars import ContextVar
from datetime import UTC, datetime
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")
logger = logging.getLogger("zeaops")
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
            "correlation_id": correlation_id.get(),
        }
        for field in ("method", "route", "status", "duration_ms"):
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        return json.dumps(payload)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    for name in ("zeaops", "uvicorn", "uvicorn.error"):
        configured = logging.getLogger(name)
        configured.handlers = [handler]
        configured.setLevel(level)
        configured.propagate = False
    # Application middleware logs route templates. Uvicorn access logs include raw query strings.
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False
    access.disabled = True


class CorrelationMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        supplied = Headers(scope=scope).get("x-correlation-id", "")
        request_id = supplied if SAFE_ID.fullmatch(supplied) else str(uuid4())
        token = correlation_id.set(request_id)
        scope.setdefault("state", {})["correlation_id"] = request_id
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Correlation-ID"] = request_id
                headers["Cache-Control"] = "no-store"
                headers["X-Content-Type-Options"] = "nosniff"
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception as exc:
            if response_started:
                # Streaming is not used in this phase. Do not expose exception text if it is added.
                logger.error("response_stream_failed")
                raise RuntimeError("Response stream failed") from None
            from zeaops.errors import unexpected_error

            response = await unexpected_error(Request(scope), exc)
            await response(scope, receive, send_with_id)
        finally:
            logger.info(
                "http_request",
                extra={
                    "method": scope["method"],
                    "route": getattr(scope.get("route"), "path", "unmatched"),
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            correlation_id.reset(token)
