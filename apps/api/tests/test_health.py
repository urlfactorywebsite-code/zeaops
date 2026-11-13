import io
import json
import logging
import threading
import time
from uuid import UUID

from sqlalchemy.exc import OperationalError


def test_liveness_does_not_access_database(client, engine):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "zeaops-api"}
    engine.connect.assert_not_called()
    assert response.headers["cache-control"] == "no-store"
    UUID(response.headers["x-correlation-id"])


def test_no_sensitive_or_fake_authenticated_operations_exist(app):
    assert {route.path for route in app.routes} == {"/health/live", "/health/ready"}
    assert all(route.methods == {"GET"} for route in app.routes)


def test_readiness_checks_database_and_schema(client, engine):
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert engine.connect.return_value.__enter__.return_value.execute.call_count == 3


def test_unavailable_database_returns_sanitized_error(client, engine):
    engine.connect.side_effect = OperationalError("password=private-value", {}, Exception("secret"))
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "not_ready"
    assert "private-value" not in response.text
    assert "secret" not in response.text
    assert response.json()["error"]["correlation_id"] == response.headers["x-correlation-id"]


def test_wrong_schema_is_not_ready(client, engine):
    engine.connect.return_value.__enter__.return_value.execute.return_value.scalar.return_value = (
        "old"
    )
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Metadata schema is not ready"


def test_correlation_header_is_preserved(client):
    response = client.get("/health/live", headers={"X-Correlation-ID": "local-test_123"})
    assert response.headers["x-correlation-id"] == "local-test_123"


def test_unsafe_correlation_header_is_replaced(client):
    response = client.get("/health/live", headers={"X-Correlation-ID": "bad id"})
    UUID(response.headers["x-correlation-id"])


def test_oversized_correlation_header_is_replaced(client):
    response = client.get("/health/live", headers={"X-Correlation-ID": "a" * 65})
    UUID(response.headers["x-correlation-id"])


def test_missing_route_uses_error_envelope(client):
    response = client.get("/unknown")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_error"


def test_method_not_allowed_preserves_allow_header(client):
    response = client.post("/health/live")
    assert response.status_code == 405
    assert "GET" in response.headers["allow"]


def test_http_server_errors_hide_internal_details(app, client):
    from fastapi import HTTPException

    @app.get("/test-http-error")
    def fail():
        raise HTTPException(500, "private-server-detail")

    response = client.get("/test-http-error")
    assert response.status_code == 500
    assert "private-server-detail" not in response.text


def test_unexpected_errors_are_sanitized(app, client):
    @app.get("/test-error")
    def fail():
        raise RuntimeError("secret-must-not-leak")

    response = client.get("/test-error")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret-must-not-leak" not in response.text
    assert response.headers["x-correlation-id"]


def test_validation_errors_do_not_echo_input(app, client):
    @app.get("/test-validation")
    def validate(count: int):
        return {"count": count}

    response = client.get("/test-validation?count=private-input")
    assert response.status_code == 422
    assert "private-input" not in response.text
    assert response.json()["error"]["code"] == "validation_error"


def test_untrusted_host_is_rejected(client):
    assert client.get("/health/live", headers={"host": "untrusted.example"}).status_code == 400


def test_docs_disabled_in_test(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_engine_is_disposed_on_shutdown(config, engine):
    from fastapi.testclient import TestClient

    from zeaops.main import create_app

    with TestClient(create_app(config, engine)):
        pass
    engine.dispose.assert_called_once()


def test_failed_probe_does_not_break_shutdown_or_leak_details(config, engine):
    from fastapi.testclient import TestClient

    from zeaops.main import create_app

    engine.connect.side_effect = RuntimeError("private-probe-detail")
    with TestClient(create_app(config, engine), raise_server_exceptions=False) as client:
        response = client.get("/health/ready")
        assert response.status_code == 500
        assert "private-probe-detail" not in response.text
    engine.dispose.assert_called_once()


def test_requests_do_not_share_correlation_ids(client):
    first = client.get("/health/live").headers["x-correlation-id"]
    second = client.get("/health/live").headers["x-correlation-id"]
    assert first != second


def test_request_logs_exclude_queries_and_include_correlation(client, monkeypatch):
    from zeaops.observability import JsonFormatter, logger

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    monkeypatch.setattr(logger, "handlers", [handler])
    response = client.get("/health/live?token=private-query")
    assert "private-query" not in stream.getvalue()
    record = json.loads(stream.getvalue())
    assert record["route"] == "/health/live"
    assert record["correlation_id"] == response.headers["x-correlation-id"]
    assert logging.getLogger("uvicorn.access").disabled


def test_slow_database_probe_has_deadline_and_does_not_accumulate_workers(
    client, engine, monkeypatch
):
    monkeypatch.setattr("zeaops.main.READINESS_TIMEOUT_SECONDS", 0.02)
    release = threading.Event()
    context = engine.connect.return_value

    def delayed_connection():
        release.wait(timeout=2)
        return context

    engine.connect.side_effect = delayed_connection
    started = time.monotonic()
    try:
        assert client.get("/health/ready").status_code == 503
        assert client.get("/health/ready").status_code == 503
        assert client.get("/health/live").status_code == 200
        assert time.monotonic() - started < 1
        engine.connect.assert_called_once()
    finally:
        release.set()
