import json
import logging

import pytest
from pydantic import ValidationError

from zeaops.observability import JsonFormatter, correlation_id
from zeaops.settings import Settings


@pytest.mark.parametrize(
    "url",
    [
        "",
        "sqlite:///test.db",
        "postgresql://u:p@localhost/db",
        "postgresql+psycopg://u@localhost/db",
        "postgresql+psycopg://u:p@localhost",
        "postgresql+psycopg://:p@localhost/db",
        "postgresql+psycopg://u:p@localhost,other/db",
        "postgresql+psycopg://u:p@localhost/db?hostaddr=192.0.2.1",
        "postgresql+psycopg://u:p@localhost/db?service=external",
        "postgresql+psycopg://u:p@localhost/db?sslmode=invalid",
    ],
)
def test_invalid_database_settings_fail(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=url)


def test_settings_hide_secret(config):
    assert "unit:unit" not in repr(config)


def test_libpq_environment_cannot_override_explicit_database_target(monkeypatch):
    monkeypatch.setenv("PGHOSTADDR", "192.0.2.1")
    with pytest.raises(ValidationError, match="Clear inherited libpq"):
        Settings(_env_file=None, database_url="postgresql+psycopg://u:p@127.0.0.1/db")


def test_invalid_environment_rejected(config):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=config.database_url, environment="staging-misspelled")


def test_structured_log_has_correlation_and_safe_fields():
    token = correlation_id.set("test-correlation")
    try:
        record = logging.LogRecord("zeaops", logging.INFO, "", 1, "http_request", (), None)
        record.method = "GET"
        record.password = "not-allowed"
        data = json.loads(JsonFormatter().format(record))
        assert data["correlation_id"] == "test-correlation"
        assert data["method"] == "GET"
        assert "password" not in data
        assert data["level"] == "INFO"
    finally:
        correlation_id.reset(token)
