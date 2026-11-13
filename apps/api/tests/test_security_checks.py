import importlib.util
from pathlib import Path


def scanner():
    path = Path(__file__).resolve().parents[3] / "scripts/check_secrets.py"
    spec = importlib.util.spec_from_file_location("secret_checks", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_scanner_detects_private_keys_and_provider_tokens_without_echoing_values():
    check = scanner()
    assert check.detect(b"-----BEGIN " + b"PRIVATE KEY-----") == ["private-key"]
    assert check.detect(b"ghp_" + b"a" * 36) == ["github-token"]
    assert check.detect(b"AKIA" + b"A" * 16) == ["aws-access-key"]


def test_scanner_detects_generated_password_in_binary_artifacts():
    password = b"dev-check-credential"
    assert scanner().detect(b"\x00bundle:" + password, password) == [
        "generated-development-credential"
    ]


def test_scanner_accepts_empty_examples_and_variable_substitution():
    assert (
        scanner().detect(b"POSTGRES_PASSWORD=\npostgresql+psycopg://user:${PASSWORD}@postgres/db")
        == []
    )
