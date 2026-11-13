import os
from pathlib import Path
from typing import Literal

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ZEAOPS_", env_file=ROOT / ".env", extra="ignore", hide_input_in_errors=True
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    allowed_hosts: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1", "api"])

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        if any(name.startswith("PG") and item for name, item in os.environ.items()):
            raise ValueError(
                "Clear inherited libpq PG environment overrides; use explicit settings"
            )
        url = PostgresDsn(value.get_secret_value())
        if url.scheme != "postgresql+psycopg":
            raise ValueError("Use the postgresql+psycopg driver")
        hosts = url.hosts()
        if len(hosts) != 1 or not hosts[0].get("username") or not hosts[0].get("password"):
            raise ValueError("One database host, a username, and a password are required")
        try:
            parsed = make_url(value.get_secret_value())
        except ArgumentError, ValueError:
            raise ValueError("Use a valid single-host SQLAlchemy PostgreSQL URL") from None
        if not parsed.database or parsed.database.strip() != parsed.database:
            raise ValueError("A database name is required")
        if set(parsed.query) - {"sslmode"}:
            raise ValueError("Only the sslmode connection option is supported in Phase 2.1")
        if parsed.query.get("sslmode", "prefer") not in {
            "disable",
            "allow",
            "prefer",
            "require",
            "verify-ca",
            "verify-full",
        }:
            raise ValueError("Invalid PostgreSQL sslmode")
        return value
