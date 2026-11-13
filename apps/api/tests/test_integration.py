import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from zeaops.database import SCHEMA_REVISION, create_database_engine
from zeaops.main import create_app
from zeaops.settings import Settings

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("ZEAOPS_RUN_INTEGRATION") != "1",
        reason="Opt in to isolated local database checks",
    ),
]


def local_settings():
    config = Settings()
    from sqlalchemy.engine import make_url

    url = make_url(config.database_url.get_secret_value())
    assert config.environment == "development"
    assert url.host == "127.0.0.1" and url.port == 18432
    assert url.database == "zeaops_metadata_dev"
    return config


def test_real_postgresql_and_migration():
    engine = create_database_engine(local_settings())
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SHOW server_version_num")).scalar().startswith("17")
            assert (
                connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
                == SCHEMA_REVISION
            )
            assert "bootstrap_metadata" in inspect(connection).get_table_names()
            # A retained data volume must be reindexed before refreshing its collation
            # version after an OS/libc base-image upgrade. New volumes match immediately.
            assert (
                connection.execute(
                    text(
                        "SELECT datcollversion IS NOT DISTINCT FROM "
                        "pg_database_collation_actual_version(oid) "
                        "FROM pg_database WHERE datname = current_database()"
                    )
                ).scalar()
                is True
            )
    finally:
        engine.dispose()


def test_real_readiness():
    with TestClient(create_app(local_settings()), base_url="http://127.0.0.1") as client:
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").json()["status"] == "ready"
