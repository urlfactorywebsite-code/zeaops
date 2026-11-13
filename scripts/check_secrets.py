"""Conservative source/build exposure checks. Never print matched credential values."""

import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "private-key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github-token": re.compile(
        rb"\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b"
    ),
    "aws-access-key": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "embedded-database-password": re.compile(
        rb"postgres(?:ql)?(?:\+psycopg)?://[^\s/:]+:[A-Za-z0-9_+=.-]{20,}@"
    ),
}


def detect(data: bytes, development_password: bytes = b"") -> list[str]:
    findings = [name for name, pattern in RULES.items() if pattern.search(data)]
    if development_password and development_password in data:
        findings.append("generated-development-credential")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--include-build", action="store_true")
    arguments = parser.parse_args()
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    paths = {ROOT / name.decode() for name in result.stdout.split(b"\0") if name}
    if arguments.include_build:
        build = ROOT / "apps/web/.next"
        if not build.is_dir():
            raise SystemExit("FAIL: build is missing; run pnpm build before scanning artifacts")
        paths.update(path for path in build.rglob("*") if path.is_file())
    password = b""
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_bytes().splitlines():
            if line.startswith(b"POSTGRES_PASSWORD="):
                password = line.partition(b"=")[2]
    failures = 0
    scanned = 0
    for path in sorted(paths):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            print(f"FAIL {relative}: source symlinks are not supported by this scanner")
            failures += 1
            continue
        # Examples are allowed; an accidentally tracked real dotenv file must fail.
        reasons = []
        if path.name.startswith(".env") and not path.name.endswith(".example"):
            reasons.append("tracked-environment-file")
        reasons.extend(detect(path.read_bytes(), password))
        scanned += 1
        if reasons:
            print(f"FAIL {relative}: {', '.join(reasons)}")
            failures += 1
    print(f"Secret exposure check: {scanned} source/build files; {failures} findings")
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
