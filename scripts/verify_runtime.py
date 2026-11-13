"""Read-only verification of the local ZeaOPS Compose runtime; never print environment values."""

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def docker(*arguments: str) -> str:
    return subprocess.check_output(["docker", *arguments], cwd=ROOT, text=True)


def main() -> None:
    endpoint = (
        os.getenv("DOCKER_HOST")
        or docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}").strip()
    )
    if not endpoint.startswith(("npipe:////./pipe/", "unix:///")) or os.getenv("DOCKER_TLS_VERIFY"):
        raise SystemExit("FAIL: runtime verification requires a local Docker socket")
    ids = docker(
        "compose",
        "--env-file",
        ".env",
        "-f",
        "infrastructure/compose/compose.yaml",
        "--project-name",
        "zeaops-dev",
        "ps",
        "--all",
        "--quiet",
    ).split()
    if len(ids) != 4:
        raise SystemExit("FAIL: expected all four local Compose services")
    containers = json.loads(docker("inspect", *ids))
    seen = set()
    summary = []
    for container in containers:
        role = container["Config"]["Labels"]["com.docker.compose.service"]
        seen.add(role)
        host = container["HostConfig"]
        assert container["Config"]["User"] in {"999:999", "10001:10001", "node"}, role
        assert host["ReadonlyRootfs"] and not host["Privileged"], role
        assert "ALL" in host["CapDrop"], role
        assert "no-new-privileges:true" in host["SecurityOpt"], role
        assert host["Memory"] == 512 * 1024 * 1024, role
        assert host["MemorySwap"] == host["Memory"], role
        assert host["NanoCpus"] == 1_000_000_000 and host["PidsLimit"] == 128, role
        assert host["LogConfig"]["Config"] == {"max-size": "10m", "max-file": "3"}, role
        for bindings in (host["PortBindings"] or {}).values():
            assert all(binding["HostIp"] == "127.0.0.1" for binding in bindings), role
        for mount in container["Mounts"]:
            assert mount["Type"] != "bind", role
            if mount["Type"] == "volume":
                assert role == "postgres" and mount["Name"] == "zeaops-dev_metadata-pg17", role
        if role == "migrate":
            assert container["State"]["ExitCode"] == 0, role
        else:
            assert container["State"]["Health"]["Status"] == "healthy", role
            uid = docker("exec", container["Id"], "id", "-u").strip()
            assert uid in {"999", "1000", "10001"}, role
        summary.append(
            {"service": role, "memory_mib": 512, "cpus": 1, "pids": 128, "read_only": True}
        )
    assert seen == {"api", "web", "postgres", "migrate"}
    print(json.dumps({"runtime_controls": "PASS", "services": summary}))


if __name__ == "__main__":
    main()
