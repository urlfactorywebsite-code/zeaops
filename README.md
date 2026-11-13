# ZeaOPS

A self-hosted infrastructure control plane. This repository implements **Phase 2.1 only: monorepo
foundation and application bootstrap**. The future domain is `ops.urlfactory.website`; this phase
does not connect to it, deploy to a VPS, or manage production infrastructure.

The dashboard shows actual local API and metadata database health. All six infrastructure modules
are clearly marked as planned. There is no simulated login, authentication boundary, SSH access,
Docker socket mount, privileged operation, or production integration.

See the verified [desktop preview](docs/images/dashboard-desktop.png) and
[mobile preview](docs/images/dashboard-mobile.png).

The current review is **functional PASS / security release FAIL** because of unresolved upstream
OS image advisories. See the [release review](docs/verification.md) before treating any green
application checks as release approval.

## Prerequisites on Windows

- Windows 11 with PowerShell 5.1 or PowerShell 7, Git, and Docker Desktop using **Linux containers**
  and the WSL2 backend. Start Docker Desktop before setup. Allow sufficient disk space for images.
- Node.js **24.22.3** (the project accepts later Node 24 patches) and pnpm **11.3.0**.
- Python **3.14.10** and uv **0.13.8**. Native database client installation is unnecessary; Psycopg
  uses its pinned binary distribution.
- Free loopback ports **18300** (web), **18301** (API), **18432** (development PostgreSQL).
- Internet access for the first dependency, image, and Playwright browser downloads.

```powershell
Set-Location F:\Projects\zeaops
node --version
python --version
docker version
npm install --global pnpm@11.3.0
python -m pip install uv==0.13.8
```

If Windows blocks local scripts, use a process-scoped policy in the current terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The project pins Node in `.node-version` and Python in `.python-version`. uv installs the required
project Python interpreter when needed. This reviewed workspace also has an ignored, SHA-256-verified
Node 24.22.3 under `.tools`; the PowerShell scripts select it automatically. A fresh clone should
install the documented Node version. To use that workspace-local Node for individual pnpm commands,
first run `. ./scripts/common.ps1` in the terminal. Machine-wide runtimes are not replaced by setup.

## First-time setup

Run every command below from the repository root. Setup preserves an existing `.env` and never
resets a volume. It generates a cryptographically random local database password in the ignored
root `.env`, installs locked dependencies, and validates Compose without printing credentials.
Treat that file as sensitive. Do not paste expanded `docker compose config` output into tickets.

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 -Mode infra
```

The `infra` command starts only this project's PostgreSQL container, waits for health, and runs
the initial Alembic migration against the generated local database. The application does not
silently create tables at startup. Run the API and web in two additional PowerShell terminals:

```powershell
# Terminal 1
Set-Location F:\Projects\zeaops
./scripts/dev.ps1 -Mode api
```

```powershell
# Terminal 2
Set-Location F:\Projects\zeaops
./scripts/dev.ps1 -Mode web
```

Open [the local dashboard](http://127.0.0.1:18300) and
[local API documentation](http://127.0.0.1:18301/docs).

```powershell
Invoke-RestMethod http://127.0.0.1:18301/health/live
Invoke-RestMethod http://127.0.0.1:18301/health/ready
Invoke-RestMethod http://127.0.0.1:18300/api/health/ready
```

`live` returns 200 independently of PostgreSQL. `ready` returns 200 only after PostgreSQL responds,
the metadata table exists, and Alembic is at the expected revision; otherwise it returns a
sanitized 503 error. Every API request receives an `X-Correlation-ID`.

## All-container local stack

Stop native web/API processes with Ctrl+C first to release their ports, then:

```powershell
./scripts/dev.ps1 -Mode stack
docker compose --env-file .env -f infrastructure/compose/compose.yaml ps
docker compose --env-file .env -f infrastructure/compose/compose.yaml logs --tail 60 api web
```

This builds the non-root PostgreSQL/API/web images, starts the isolated PostgreSQL instance, runs a one-shot
migration service, and waits for API/web health. All services have a 512 MiB memory/swap ceiling, one CPU,
a 128-process limit, and rotating logs (10 MiB per file, three files). Runtime filesystems are
read-only; only PostgreSQL metadata storage and bounded temporary filesystems are writable. Published ports bind only to `127.0.0.1`.
The stack uses the dedicated `zeaops-dev_metadata-pg17` volume and `zeaops-dev_control-plane`
network. No host directories or pre-existing database volumes are mounted.

```powershell
# Stop this project's containers; preserve the metadata volume.
./scripts/dev.ps1 -Mode stop
```

Do not delete `.env` while retaining the database volume: PostgreSQL initialization credentials
only apply to an empty data directory. Preserve both together. No destructive volume-reset
script is provided. For SQL access without putting the password on the command line:

```powershell
docker compose --env-file .env -f infrastructure/compose/compose.yaml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Checks and tests

```powershell
# Once per Playwright release
pnpm exec playwright install chromium

# Formatting, lint, strict typing, unit tests, build, and Compose validation
./scripts/check.ps1

# Include real database integration and desktop/mobile Chromium tests.
# Start infra and the native API first. Playwright starts the built web app automatically.
./scripts/check.ps1 -Integration -Browser -Security
```

With the all-container stack already running, browser tests reuse its web server:

```powershell
pnpm test:e2e
```

Individual checks:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
python -m uv run --locked ruff check .
python -m uv run --locked ruff format --check .
python -m uv run --locked mypy
python -m uv run --locked pytest -m 'not integration'
docker compose --env-file .env -f infrastructure/compose/compose.yaml config --quiet
```

Integration tests are opt-in and refuse a database outside the known local host, port, database
name, and development environment. Unit tests isolate database failures with test doubles; the
integration suite verifies real PostgreSQL and Alembic. Browser tests include real proxy/API/DB
connectivity, desktop/mobile navigation, preferences, keyboard focus, reduced motion, and a
separate explicitly simulated outage scenario. CI is configured to perform these checks on Ubuntu and also
builds and health-checks the full Compose stack. Hosted CI execution has not been triggered locally. CI is not a production deployment pipeline.

Use `pnpm format` and `python -m uv run --locked ruff format .` to format code. New dependencies
must be exact versions; regenerate and commit both lockfiles when changing them. Container
base versions are pinned in Dockerfiles/Compose. Review security updates deliberately.

For package and source security checks after a build: `./scripts/check.ps1 -Security`. This includes both
package vulnerability feeds, installed Python dependency compatibility, and source/build credential
exposure checks. CI additionally runs checksum-pinned Gitleaks and Trivy; its image gate fails on
HIGH/CRITICAL findings, including unfixed findings. The current image gate is expected
to fail until the upstream OS findings in the verification report are resolved. Full reports are
retained as CI artifacts; a passing application test suite is not security release approval.

After building the local images, run `./scripts/smoke.ps1` to prove initialization and migration
replay on a fresh, port-free, randomly named Compose project. It removes only its own disposable
containers and volume; it preserves `zeaops-dev_metadata-pg17`. Run
`python -m uv run --locked python scripts/verify_runtime.py` for read-only inspection of the
actual development containers. Web/API runtime images omit npm/yarn and pip installation tooling;
development tests and unused root-only privilege-switching tools are excluded. Debian package
tools and metadata remain available for OS inventory and vulnerability scanning.

## Repository layout

```text
apps/web/                 Next.js App Router application and browser tests
apps/api/                 FastAPI source, Alembic migrations, Pytest suite
packages/ui/              Owned shadcn/ui-style Radix/CVA components
packages/api-client/      Same-origin health client with runtime response validation
packages/contracts/       Zod schemas and shared TypeScript types
infrastructure/compose/   Isolated local Docker stack
infrastructure/authentik/ Identity integration boundary documentation
scripts/                  Guarded PowerShell setup, dev, and check commands
docs/                     Architecture, security boundaries, verification evidence
.github/workflows/        Lint, type, test, build, and container CI
```

## Environment and troubleshooting

The backend reads root `.env` through typed Pydantic settings. The native web server defaults
to the loopback API; an optional `apps/web/.env.local` may set `ZEAOPS_API_INTERNAL_URL`.
The container uses `http://api:18301` at runtime. This URL is server-only and must be an HTTP(S)
origin without a path, embedded credentials, query, or fragment. Database credentials never
enter client environment variables. `.env.production.example` is documentation only and is
intentionally unusable until configured; no production Compose stack is supplied.

- **Missing uv:** install it with the pinned pip command above. Scripts use `python -m uv`, so
  a new terminal or PATH change is unnecessary.
- **Docker connection error:** start Docker Desktop and select Linux containers. `docker info`
  must succeed before setup. Check port conflicts with `Get-NetTCPConnection -LocalPort 18300,18301,18432`.
- **Readiness 503:** run `./scripts/dev.ps1 -Mode infra` and inspect local Compose logs. Check
  the API's sanitized JSON event and correlation ID. Do not point the environment at a real VPS.
- **Collation version mismatch after an OS image update:** preserve the local volume and take a
  database backup. Reindex affected database objects before refreshing the collation version;
  refreshing the version alone does not rebuild indexes. The integration suite checks the local
  metadata database for this mismatch. See the guarded local repair evidence in
  [the verification report](docs/verification.md); never reuse those commands on a production target.
- **Environment guard failed:** local scripts require the generated development `.env`; clear
  externally set database/Compose overrides, including `PG*`/libpq variables. Scripts reject duplicate entries, inconsistent
  passwords, remote web origins, and remote Docker contexts. The supported development connection
  URL accepts no query parameters; backend URLs support only `sslmode`.
- **pnpm engine failure:** check Node and pnpm versions. Use the documented versions, then
  rerun `pnpm install --frozen-lockfile`.
- **Slow downloads:** rerun setup; package caches are reusable and the existing `.env` is kept.
- **Playwright cannot find Chromium:** run the browser install command; on Linux CI include
  `--with-deps`.

See [architecture](docs/architecture.md), [security boundaries](docs/security.md), and the
[verification record](docs/verification.md). This is an application foundation, not authorization
to expose the service publicly. Production identity, infrastructure access, and deployment
remain outside Phase 2.1.
