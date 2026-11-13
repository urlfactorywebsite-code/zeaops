import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
POWERSHELL = shutil.which("pwsh") or shutil.which("powershell")
pytestmark = pytest.mark.skipif(not POWERSHELL, reason="PowerShell is a development prerequisite")


def run_script(command, environment=None):
    clean = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("PG", "POSTGRES_", "COMPOSE_", "ZEAOPS_", "DOCKER_"))
    }
    clean.update(environment or {})
    common = str(ROOT / "scripts/common.ps1").replace("'", "''")
    return subprocess.run(
        [
            POWERSHELL,
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            f". '{common}'; {command}",
        ],
        env=clean,
        capture_output=True,
        text=True,
        timeout=15,
    )


def fixture_environment():
    password = "ab" * 32
    return (
        "COMPOSE_PROJECT_NAME=zeaops-dev\nPOSTGRES_USER=zeaops_dev\n"
        f"POSTGRES_DB=zeaops_metadata_dev\nPOSTGRES_PASSWORD={password}\n"
        "ZEAOPS_ENVIRONMENT=development\nZEAOPS_LOG_LEVEL=INFO\n"
        f"ZEAOPS_DATABASE_URL=postgresql+psycopg://zeaops_dev:{password}@127.0.0.1:18432/zeaops_metadata_dev\n"
        "ZEAOPS_API_INTERNAL_URL=http://127.0.0.1:18301\n"
    )


@pytest.mark.parametrize(
    "change",
    [
        "valid",
        "duplicate",
        "different-password",
        "remote-host",
        "different-database",
        "remote-web",
        "unknown-key",
    ],
)
def test_local_environment_parser_rejects_unsafe_or_inconsistent_targets(tmp_path, change):
    content = fixture_environment()
    if change == "duplicate":
        content += "ZEAOPS_DATABASE_URL=postgresql+psycopg://u:p@192.0.2.1/db\n"
    if change == "different-password":
        content = content.replace("POSTGRES_PASSWORD=ab", "POSTGRES_PASSWORD=cd")
    if change == "remote-host":
        content = content.replace("@127.0.0.1", "@192.0.2.1")
    if change == "different-database":
        content = content.replace("POSTGRES_DB=zeaops_metadata_dev", "POSTGRES_DB=other")
    if change == "remote-web":
        content = content.replace("http://127.0.0.1:18301", "http://192.0.2.1:18301")
    if change == "unknown-key":
        content += "UNKNOWN_KEY=value\n"
    path = tmp_path / ".env"
    path.write_text(content)
    result = run_script(
        f"$null = Read-LocalEnvironment -Path '{str(path).replace(chr(39), chr(39) * 2)}'"
    )
    assert (result.returncode == 0) is (change == "valid")
    assert "abababab" not in result.stdout + result.stderr


@pytest.mark.parametrize(
    "key",
    ["PGHOSTADDR", "PGSERVICE", "COMPOSE_FILE", "ZEAOPS_DATABASE_URL", "ZEAOPS_API_INTERNAL_URL"],
)
def test_inherited_connection_overrides_are_refused_before_commands(key):
    result = run_script(
        "function Read-LocalEnvironment { return @{} }; Assert-LocalEnvironment",
        {key: "blocked-test-value"},
    )
    assert result.returncode != 0
    assert "blocked-test-value" not in result.stdout + result.stderr


@pytest.mark.parametrize(
    "endpoint,allowed",
    [
        ("ssh://192.0.2.1", False),
        ("tcp://192.0.2.1:2376", False),
        ("unix:///var/run/docker.sock", True),
        ("npipe:////./pipe/dockerDesktopLinuxEngine", True),
    ],
)
def test_docker_guard_never_connects_to_remote_endpoints(endpoint, allowed):
    result = run_script(
        "function docker { throw 'Docker must not be called' }; Assert-LocalDocker",
        {"DOCKER_HOST": endpoint},
    )
    assert (result.returncode == 0) is allowed
