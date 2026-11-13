from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from zeaops.database import SCHEMA_REVISION
from zeaops.main import create_app
from zeaops.settings import Settings


@pytest.fixture
def config():
    return Settings(
        _env_file=None,
        environment="test",
        database_url="postgresql+psycopg://unit:unit@127.0.0.1:1/unit",
        allowed_hosts=["testserver"],
    )


@pytest.fixture
def engine():
    engine = MagicMock(spec=Engine)
    engine.connect.return_value.__enter__.return_value.execute.return_value.scalar.return_value = (
        SCHEMA_REVISION
    )
    return engine


@pytest.fixture
def app(config, engine):
    return create_app(config, engine)


@pytest.fixture
def client(app):
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
