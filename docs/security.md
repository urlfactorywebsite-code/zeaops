# Security boundaries

- All supplied development ports bind to loopback. Keep Docker Desktop local and do not publish
  these ports through a reverse proxy, firewall rule, or VPS.
- The application has no authentication. It exposes only health checks and UI preferences, with
  planned module descriptions. Local mode is not a security substitute for production identity.
- No SSH, host filesystem mounts, Docker socket, object storage credentials, CrowdSec enrollment,
  production PostgreSQL connection, or privileged API is present.
- Setup generates a random 256-bit development password and writes only ignored `.env` state.
  Examples contain no usable secrets. Avoid printing expanded Compose configuration or settings.
- Local scripts check the exact generated local connection shape and reject inherited database
  overrides before migrations. Duplicate or inconsistent configuration and remote Docker endpoints
  are refused. Typed backend settings reject inherited `PG*` overrides, multi-host URLs, and query
  parameters that could silently redirect a configured database target. Direct Alembic commands remain an operator tool: always verify
  the target environment before using them outside these scripts.
- Readiness exposes no database version, hostname, credential, SQL, or exception text. Correlation
  IDs are constrained to 64 ASCII identifier characters or replaced with a UUID. Request logs omit
  queries, bodies, headers, raw exception text, and arbitrary extra fields.
- TrustedHost rejects unexpected hosts. No broad CORS policy is needed because browser health
  calls use a fixed same-origin proxy. Framework host rejection is a plain 400 response; application
  HTTP, validation, and unexpected errors use the centralized JSON envelope.
- Runtime containers have read-only root filesystems, dropped capabilities, no-new-privileges,
  CPU/memory/swap/PID limits, and bounded log rotation. npm/yarn, pip installation tooling, and unused
  privilege-switching tools are removed from their respective runtime images. Debian package tools
  and metadata remain for OS inventory. Application source and dependencies are root-owned.
- API docs and OpenAPI are available only in development. All container users are non-root;
  production environment settings alone do not make this a production-ready deployment.
- Future production work requires TLS, OIDC/session validation, RBAC, CSRF strategy, suitable CSP,
  rate limiting, secret management, role separation, audit logs, backup/restore verification,
  dependency review, and ingress/network controls. These are intentionally not simulated here.

No production infrastructure changes are part of this repository bootstrap.

Secret scanners and vulnerability feeds provide bounded evidence, not proof of the absence of
all secrets or vulnerabilities. The lightweight source/build check recognizes selected provider
patterns and the generated local password. Gitleaks adds broader source scanning. Trivy scans
exported images without mounting the Docker socket; CI gates all high/critical findings, including unfixed findings.
Unfixed upstream OS findings and tool support limits are recorded in the verification report.

The final Phase 2.1 assessment maps every HIGH/CRITICAL image finding to its installed version,
upstream fix, Debian stable availability, runtime exposure, and controls in
[security-findings.csv](security-findings.csv). Absent-component assessments do not suppress scanner
results. The strict image gate remains FAIL. Unused API/Web mount tooling and PostgreSQL GnuPG
tooling are removed; Essential packages and required database libraries are preserved.
