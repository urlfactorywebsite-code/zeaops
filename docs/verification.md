# ZeaOPS Phase 2.1 completeness and release review

Reviewed locally on **13 November 2026 (Asia/Calcutta)** in `F:\Projects\zeaops`.

**Functional Phase 2.1 checks: PASS. Unqualified security release approval: FAIL.**
Application checks pass, but full container scans retain unfixed upstream OS advisories. No
security waiver has been applied. Production deployment remains outside scope and is not approved.
GitHub-hosted execution was not triggered; the local equivalents and fresh-container checks ran.

The follow-up review reran the checks against the current repository. The monorepo foundation is
functionally implemented; full release sign-off remains blocked by the image security gate, and
hosted CI execution remains unverified. Planned infrastructure modules and deferred identity are
intentional Phase 2.1 boundaries, not partially implemented Phase 2.2 features.

The final security refinement reduced high-severity package/advisory findings from **215 to 200**
across the three images. The existing PostgreSQL critical finding remains; no new critical finding
was introduced. Every remaining HIGH/CRITICAL row has an assessment in
[security-findings.csv](security-findings.csv). Those assessments do not alter the strict scanner gate.

## Completed foundation features

| Requirement                                       | Status                        | Evidence                                                                                                                                   |
| ------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo structure and pinned dependencies        | PASS                          | All requested directories, pnpm workspaces, strict shared TypeScript, exact dependency versions, and both lockfiles                        |
| Next.js App Router application                    | PASS                          | Optimized build, live local application, health proxy, and desktop/mobile Chromium checks                                                  |
| Futuristic dashboard and accessibility foundation | PASS                          | Cyan/violet theme, illuminated cards, responsive drawer, keyboard navigation, inert modal background, reduced-motion support               |
| Shared UI, API client, and contracts              | PASS                          | Owned Radix/CVA components, bounded same-origin client, Zod response/preferences validation, independent package type checks               |
| FastAPI bootstrap                                 | PASS                          | Factory, liveness/readiness routes, graceful lifespan, real HTTP checks, no privileged operations                                          |
| PostgreSQL 17 and Alembic                         | PASS                          | Dedicated local volume, initial metadata migration, real connection tests, replay and drift checks, fresh-volume initialization            |
| Typed settings and API validation                 | PASS                          | Pydantic environment validation, connection override guards, schema validation, sanitized failures                                         |
| Structured logging and correlation                | PASS                          | JSON request events, safe correlation IDs, omitted query/body/credential data, centralized API errors                                      |
| Local Docker stack and Dockerfiles                | PASS                          | Three images build, four services complete their expected lifecycle, non-root/read-only runtimes and resource controls verified            |
| Windows setup and development scripts             | PASS                          | Guarded setup/dev/check/smoke workflows; 16 actual PowerShell guard tests; generated environment and existing data preserved               |
| Tests and CI configuration                        | PASS locally / NOT RUN hosted | 82 automated tests pass; workflow implements locked checks, builds, migrations, browser tests, and security gates; no hosted run triggered |
| Documentation and production separation           | PASS                          | Windows prerequisites/setup, architecture and limitations documented; production example has no credentials or usable connection           |
| Strict container security release gate            | FAIL                          | Unfixed OS findings remain in all three images; no suppressions or waiver                                                                  |

## Final security refinement

All 15 pre-existing Trivy JSON reports were inspected, including historical Debian 12 results,
Debian 13 final results, and severity-filtered gate results. Six fresh reports bring the local report
index to 21 entries in `.artifacts/final-security/historical-report-index.csv`. Historical findings
belong to their recorded image IDs and must not be attributed to the current image by filename alone.

The assessment CSV contains **216 baseline HIGH/CRITICAL rows**: 201 retained and 15 removed, covering
34 unique CVEs. It records each image, installed package/version, scanner severity, upstream fix,
Debian unstable fix, lack of a listed Debian 13 fix, runtime exposure, controls, and primary advisory.
All 34 Debian advisory pages were retrieved and retained under `.artifacts/final-security/advisories`.
The MIT Kerberos release announcement and advisory supplied additional upstream fix information.

Changes made:

- Removed the unused `mount` package from API and Web runtime stages. Each removal eliminates four
  HIGH findings, one MEDIUM finding, and one LOW finding per image. Debian Essential packages and package metadata remain intact.
- Removed PostgreSQL's unused GnuPG tooling and orphaned libraries: `dirmngr`, `gnupg`, `gnupg-l10n`,
  `gpg`, `gpg-agent`, `gpgconf`, `gpgsm`, `pinentry-curses`, `libassuan9`, `libgnutls30t64`, `libksba8`,
  `libnpth0t64`, `libp11-kit0`, and `libtasn1-6`. This eliminates seven HIGH findings and 14 installed
  packages. PostgreSQL, psql, and their dynamic dependencies remain intact.
- Rejected removal plans that would uninstall Essential packages or the database. PostgreSQL's
  `postgresql-common -> systemd -> mount` dependency chain means its mount package is retained.
  No `--allow-remove-essential`, forced dependency breakage, metadata deletion, or vulnerability
  ignore rule was introduced.
- Retained the already patched Node 24.22.3, Python 3.14.10, PostgreSQL 17.12, immutable image
  digests, locked dependencies, and exact zlib security patch. No compatible fixed stable package
  was identified for the remaining HIGH/CRITICAL rows. Upstream and unstable fixes exist, as listed
  below; importing unstable packages or compiling replacement OS libraries requires separate ABI
  and maintenance review and was not used as a release shortcut.
- Reviewed builder dependencies: the API already installs only hash-locked production wheels,
  without a compiler toolchain; the web build needs TypeScript/Next/Tailwind tooling and traces only
  runtime files into the final image. Test and lint dependencies remain isolated from runtime images.
- Extended `.gitignore` and `.dockerignore` to exclude secret directories, private-key/certificate
  formats, database dumps, additional caches, and test output. Examples and lockfiles remain visible.
- Fixed a retained local database collation mismatch from the earlier libc 2.36 -> 2.41 image change.
  Created and archive-validated `.artifacts/backups/zeaops-pre-final-security.dump` (4,435 bytes),
  reindexed `zeaops_metadata_dev`, then refreshed its collation version. Both versions now read 2.41.
  Added an integration assertion to detect future mismatches. No volume was reset or replaced.

Package removals reduce the installed runtime surface; inherited image layers still contain their
original bytes, so this review does not claim a proportional download-size reduction. Application
features, authentication, dependency pins, and production configuration were not expanded.

### API and Web: every high-severity advisory

The original 47 API / 46 Web package rows represent **11 unique CVEs**. After removing mount, 43 / 42
rows remain. No remaining row lists a fixed Debian 13 version. Fixed versions below are upstream
or Debian unstable/testing, not compatible stable updates available to the pinned images.

| CVE / primary source                                                           | Affected installed packages and version                                                                        | Fixed version evidence                                                                    | Exposure and disposition                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CVE-2026-76642](https://security-tracker.debian.org/tracker/CVE-2026-76642)   | util-linux family 2.41.5-0+deb13u1, including bsdutils epoch 1 and login's `1:4.16.0-2+really2.41.5-0+deb13u1` | upstream 2.42.3; Debian unstable 2.42.3-1                                                 | Mount helper/hook privilege escalation. mount CLI removed from API/Web; libmount and Essential utilities remain. No mount calls, host filesystem mounts, CAP_SYS_ADMIN, or privilege gain through exec. Retained; low current exposure.   |
| [CVE-2026-78408](https://security-tracker.debian.org/tracker/CVE-2026-78408)   | Same util-linux family                                                                                         | upstream 2.42.4; Debian unstable 2.42.4-1                                                 | Requires a privileged nsenter --join-cgroup operation. No namespace/cgroup operations or host cgroup mounts. Retained; low current exposure.                                                                                              |
| [CVE-2026-78409](https://security-tracker.debian.org/tracker/CVE-2026-78409)   | Same util-linux family                                                                                         | upstream 2.42.3; Debian unstable 2.42.3-1                                                 | Requires authorized mount/subdirectory operations. No application mount/fstab workflow. Retained; low current exposure.                                                                                                                   |
| [CVE-2026-78410](https://security-tracker.debian.org/tracker/CVE-2026-78410)   | Same util-linux family                                                                                         | upstream 2.42.3; Debian unstable 2.42.3-1                                                 | Privileged bind mount/path race. No privileged mounting or attacker-controlled host path. Retained; low current exposure.                                                                                                                 |
| [CVE-2026-54369](https://security-tracker.debian.org/tracker/CVE-2026-54369)   | libacl1 2.3.2-2+b1                                                                                             | upstream 2.4.0; Debian unstable 2.4.0-1                                                   | Requires a privileged caller following attacker-controlled paths. No ACL API, non-root service UID, read-only application files. Retained; low current exposure.                                                                          |
| [CVE-2025-69720](https://security-tracker.debian.org/tracker/CVE-2025-69720)   | ncurses-bin, ncurses-base, libtinfo6 6.5+20250216-2; also API libncursesw6                                     | upstream 6.5-20251213; Debian unstable 6.6+20251231-1                                     | The affected infocmp CLI exists in Essential ncurses-bin but is never called by the application. Library/data package matches overstate which binary contains the flaw; the image still contains the CLI. Retained; low current exposure. |
| [CVE-2026-119373](https://security-tracker.debian.org/tracker/CVE-2026-119373) | libsqlite3-0 3.46.1-7+deb13u2                                                                                  | upstream 3.54.0; Debian unstable 3.54.1-1                                                 | FTS5 doclist heap overflow. Application accepts no SQLite files, SQL, or FTS queries. Retained; low current exposure.                                                                                                                     |
| [CVE-2026-119374](https://security-tracker.debian.org/tracker/CVE-2026-119374) | Same libsqlite3-0                                                                                              | same SQLite fixes                                                                         | FTS5 secure-delete heap overflow. No SQLite data path. Retained; low current exposure.                                                                                                                                                    |
| [CVE-2026-119379](https://security-tracker.debian.org/tracker/CVE-2026-119379) | Same libsqlite3-0                                                                                              | same SQLite fixes                                                                         | Crafted SQLite changeset heap overflow. No changeset processing. Retained; low current exposure.                                                                                                                                          |
| [CVE-2026-16742](https://security-tracker.debian.org/tracker/CVE-2026-16742)   | libsystemd0 and libudev1 257.13-1~deb13u1                                                                      | upstream supported branches 258.10 / 259.8 / 260.4 / 261.2 / 262; Debian unstable 261.2-1 | Vulnerable component is systemd-homed, absent from both images. Source-package matching produces a component-level false positive for these installed libraries. No homed-managed users or service. Retained in scanner; no suppression.  |
| [CVE-2026-9538](https://security-tracker.debian.org/tracker/CVE-2026-9538)     | perl-base 5.40.1-6+deb13u1                                                                                     | upstream Archive::Tar 3.10; Debian unstable Perl 5.42.3-1                                 | Archive::Tar is absent: actual `perl -MArchive::Tar` probes fail with expected exit 2. Component-level false positive in API/Web. Retained in scanner; no suppression.                                                                    |

The remaining util-linux binary packages are `bsdutils`, `libblkid1`, `liblastlog2-2`, `libmount1`,
`libsmartcols1`, `libuuid1`, `login`, and `util-linux`. The CSV preserves each package's exact version.
Node's built-in SQLite is separately patched at **3.54.1**, confirmed with `process.versions.sqlite`;
the flagged Debian libsqlite3 remains installed. Python's SQLite module uses 3.46.1. Neither service
uses SQLite for ZeaOPS. This distinction does not make the OS library finding disappear.

Upstream component evidence: [systemd-homed advisory](https://github.com/systemd/systemd/security/advisories/GHSA-jm29-p7hh-vjhv),
[Node security release and bundled SQLite update](https://nodejs.org/en/blog/release/v24.22.3),
and [Debian SQLite fix tracking](https://bugs.debian.org/1152790).

### PostgreSQL critical and remaining high findings

**CVE-2026-6653 is retained as a genuine vulnerable-library finding.** The installed libxml2 is
`2.12.7+dfsg+really2.9.14-2.1+deb13u3`: its apparent 2.12 prefix does not prove it contains the
upstream 2.11 fix, because Debian reverted to a legacy 2.9.14 code line. Debian marks this stable
package vulnerable and minor/no-DSA. Debian unstable first fixed it at `2.14.5+dfsg-0.1`; the current
fixed unstable/testing package is `2.15.4+dfsg-1`.

`ldd` confirms postgres loads libxml2.so.2. A harmless XMLPARSE query succeeded, demonstrating an
authenticated SQL XML path. No exploit payload was executed. PostgreSQL's
[XML documentation](https://www.postgresql.org/docs/17/functions-xml.html) confirms these functions
depend on libxml. The application exposes no XML input, SQL console, or arbitrary queries; the
database has loopback-only publication, random local credentials, and SCRAM host authentication.
Residual availability/memory-safety risk remains **medium in this local configuration**, with a
CRITICAL scanner classification. Resource limits bound some denial-of-service impact and do not
repair the vulnerable library. No public or production release is approved.

Other PostgreSQL HIGH findings are covered individually by the CSV:

- The API/Web OS families above also occur in PostgreSQL. mount is retained because removing it
  would remove systemd/postgresql-common/postgresql-17. Non-root UID, dropped capabilities,
  no-new-privileges, read-only roots, and absence of a management API constrain exposure.
- `libgssapi-krb5-2`, `libk5crypto3`, `libkrb5-3`, and `libkrb5support0` **1.21.3-5+deb13u1** account
  for 56 HIGH rows across 14 CVEs: CVE-2026-107364, CVE-2026-112315 through CVE-2026-112323,
  CVE-2026-118380, CVE-2026-119079, CVE-2026-71199, and CVE-2026-71200. MIT fixes these in
  **1.22.3**; Debian currently lists no fixed stable or unstable package for these rows. Several
  concern KDC/kadmind/libgssrpc components not installed here. Generic GSS library paths cannot be
  dismissed collectively. The configured keytab `/etc/postgresql-common/krb5.keytab` is absent;
  pg_hba uses only local trust and SCRAM, with no GSS/PAM/LDAP authentication rule. Keep the findings
  open pending a supported distro update; reevaluate immediately if GSS or keytabs are introduced.
  See [MITKRB5-SA-2026-001](https://web.mit.edu/kerberos/advisories/MITKRB5-SA-2026-001.txt) and
  [the MIT release announcement](https://mailman.mit.edu/pipermail/kerberos-announce/2026q4/000212.html).
- libxml2 also has seven HIGH rows: CVE-2026-74860 and CVE-2026-86138/86139/86140/86142/86143/86144.
  The Python SAX-binding path in 74860 is absent; the remaining core library paths remain open.
  Upstream fixes are 2.15.3 for 74860 and 2.15.4 for the six 861xx findings. Debian unstable fixes
  are 2.15.3+dfsg-1 and 2.15.4+dfsg-1 respectively; no stable fix is listed. Same XML/SQL access
  controls apply; do not treat the absence of an HTTP XML endpoint as a library patch.
- PostgreSQL includes Archive::Tar **3.02_001** in its full Perl tooling, unlike API/Web. It is
  vulnerable to CVE-2026-9538 but no ZeaOPS route processes archives or invokes Perl. The four Perl
  package rows remain open; current exposure is low. Removing this dependency chain would remove
  PostgreSQL tooling, so it was preserved.
- Seven GnuPG HIGH package rows for [CVE-2026-24882](https://security-tracker.debian.org/tracker/CVE-2026-24882)
  were removed with unused tooling. The old installed versions were 2.4.7-21+deb13u1 (some binaries
  had +b5); upstream fixes are 2.5.17 or Debian unstable backport 2.4.9-4. There is no retained
  GnuPG runtime requirement or scanner exception.

Risk owner for the open image findings is the ZeaOPS Security/DevOps maintainer. Recheck at the next
supported stable security/base update and before any exposure beyond this local development stack.
Closure requires patched/removed components and rebuilt-image gates passing under the same policy.
The medium/low/unknown totals remain in the full JSON; this focused assessment covers the release
gate's HIGH/CRITICAL rows and does not certify lower severities as harmless.

### CI and secret handling review

- `contents: read` is the only declared GitHub token permission; checkout disables persisted
  credentials. Actions use immutable 40-character revisions; runtimes/package managers are exact
  versions, and dependency installation is frozen/locked.
- No `pull_request_target`, production environment, deployment job, repository secret reference,
  credentials in build arguments, or Docker socket mount exists. Native API logs stay in runner
  temporary storage and are not uploaded as audit artifacts.
- Gitleaks/Trivy downloads are version- and SHA-256-pinned. Audit artifacts contain redacted source
  results and image reports, not `.env`, database dumps, or container environment inspection output.
  Retention is seven days. Strict HIGH/CRITICAL exit code 1 includes unfixed findings.
- `git check-ignore --no-index` passed for 28 representative secret/generated paths and preserved
  five source/example paths. No real dotenv file is tracked. The repository has no commits, so
  there is no existing commit history to scan; source/build checks and Gitleaks cover current files.
- Hosted CI was not triggered. Source review and local equivalents pass except the unchanged
  image gate. A successful hosted run is still required for any future CI release claim.

## Earlier follow-up review changes

- Fixed duplicate API image builds: `api` alone owns the Compose build configuration; `migrate`
  reuses the same image. Previously both targets built concurrently and wrote the same tag.
  Verified three build targets, successful migration/API startup, and fresh-volume smoke behavior.
- Bounded the smoke script's Python health request to six seconds and Node health fetch to eight
  seconds. The script now fails and reaches cleanup when a health request stalls.
- Refreshed this completeness report and scan evidence. No application features, dependency pins,
  authentication, or Phase 2.2 infrastructure operations were added in this follow-up.
- Corrected documentation to distinguish removed npm/yarn/pip tooling from the Debian package
  tools retained for OS inventory, and to scope structured logging claims to the API.

## Scope and changes

Reviewed the repository structure, Next.js App Router shell, shared UI/contracts/client, FastAPI
factory, settings, error/logging middleware, SQLAlchemy/Alembic, PostgreSQL, Dockerfiles, Compose,
PowerShell workflows, CI, tests, and documentation. No Phase 2.2 code or production connection was added.

Earlier implementation/review fixes retained and rechecked:

- Replaced vulnerable transitive minimatch 10.2.6 with a scoped 11.0.8 override; retained the unaffected
  legacy 3.x dependency. Matched Node type definitions to the Node 24 runtime line. Peer checks pass.
- Updated Node 24.14.1 to 24.22.3, Python 3.14.3 to 3.14.10, and PostgreSQL 17.9 to 17.12; pinned
  the Debian 13 base digests and exact zlib security package `1:1.3.dfsg+really1.3.1-1+deb13u1`.
- Removed unused npm/yarn, pip/setuptools, and root-only gosu tools from runtime images; excluded
  API tests and build tooling. Application code and dependencies are root-owned.
- Added non-root users, read-only roots, dropped capabilities, no-new-privileges, bounded temporary
  filesystems, 512 MiB memory/swap limits, one CPU, 128 PIDs, and 10 MiB x 3 log rotation to all services.
- Replaced loose environment regex matching with strict duplicate/key/value validation. Reject
  inconsistent passwords, remote targets, inherited libpq/Compose overrides, and remote Docker endpoints.
  Backend settings also reject unsupported multi-host URLs and target-changing connection options.
- Validated and size-bounded health proxy payloads, disabled upstream redirects, normalized error
  bodies/correlation IDs, and prevented malformed HTML/parser details from reaching the browser.
  Readiness now requires the correct endpoint-specific response, rather than accepting liveness data.
- Preserved HTTP 405 Allow headers; sanitized HTTP 5xx details; ensured pool disposal after failed
  readiness probes and bounded shutdown waits. Added regression coverage for these defects.
- Replaced deprecated HTTPX TestClient support with pinned HTTPX2 and added locked pip-audit tooling.
- Added source/build secret checks, PowerShell guard tests, actual runtime inspection, and a fresh,
  port-free disposable Compose migration smoke script. Existing development storage is preserved.
- Updated CI to immutable Node-24-based action revisions, disabled persisted checkout credentials,
  fixed native API process cleanup, bounded health curl requests, added security gates and audit artifacts.
- Fixed the monorepo React lint version lookup and mobile navigation focus when resizing to
  desktop. Open mobile navigation makes the background inert; static sidebar copy no longer
  implies API health. Updated setup/runtime/security documentation.

## Exact checks executed

The aggregate command was `./scripts/check.ps1 -Integration -Browser -Security`. Its checks and
additional runtime/scanner commands are listed below. Results refer to the reviewed source and
rebuilt local images; only the image security gate fails.

| Command / check                                                                        | Result  | Observed result                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                       | PASS    | Locked workspace installation using Node 24.22.3 / pnpm 11.3.0                                                                           |
| `python -m uv sync --system-certs --locked`                                            | PASS    | Project interpreter Python 3.14.10; locked dependencies installed                                                                        |
| `pnpm peers check`                                                                     | PASS    | No peer dependency issues                                                                                                                |
| `pnpm format:check`                                                                    | PASS    | All matched files formatted                                                                                                              |
| `pnpm lint`                                                                            | PASS    | ESLint, zero lint warnings                                                                                                               |
| `pnpm typecheck`                                                                       | PASS    | Strict checks across all four workspace packages                                                                                         |
| `pnpm test`                                                                            | PASS    | 19 tests in 4 files                                                                                                                      |
| `pnpm build`                                                                           | PASS    | Optimized Next.js production build                                                                                                       |
| `python -m uv run --locked ruff check .`                                               | PASS    | Python sources, tests, and scripts                                                                                                       |
| `python -m uv run --locked ruff format --check .`                                      | PASS    | Formatting verified                                                                                                                      |
| `python -m uv run --locked mypy`                                                       | PASS    | Strict typing, 6 application source files                                                                                                |
| `python -m uv run --locked pytest -m 'not integration'`                                | PASS    | 53 tests: 20 health/lifecycle, 14 settings/logging, 16 PowerShell guard cases, 3 scanner tests                                           |
| `ZEAOPS_RUN_INTEGRATION=1 python -m uv run --locked pytest -m integration`             | PASS    | 2 real PostgreSQL/schema/readiness tests                                                                                                 |
| `python -m uv run --locked alembic -c apps/api/alembic.ini upgrade head`               | PASS    | Existing local database migration replay                                                                                                 |
| `python -m uv run --locked alembic -c apps/api/alembic.ini check`                      | PASS    | No new upgrade operations / schema drift                                                                                                 |
| `docker compose --env-file .env -f infrastructure/compose/compose.yaml config --quiet` | PASS    | Local Compose validates                                                                                                                  |
| `./scripts/setup.ps1 -SkipInstall`                                                     | PASS    | Existing generated development environment preserved                                                                                     |
| Guarded `docker compose ... build` and `docker compose ... up -d --wait`               | PASS    | All three images build (cached layers reused); PostgreSQL/API/web healthy; migration exits 0; only API builds the shared migration image |
| `./scripts/smoke.ps1`                                                                  | PASS    | Fresh independent volume initializes; migration replay/drift and API/web proxy checks pass; only its own temporary project is removed    |
| `python -m uv run --locked python scripts/verify_runtime.py`                           | PASS    | Actual users, read-only roots, capabilities, ports, resources, logs, and volume isolation verified                                       |
| `pnpm test:e2e`                                                                        | PASS    | 8 Chromium tests across desktop/mobile against actual services; only the named outage-presentation case mocks a response                 |
| Actual `/health/live`, `/health/ready`, `/api/health/ready` HTTP probes                | PASS    | HTTP 200 with expected body, cache and correlation headers                                                                               |
| Real local PostgreSQL stop/restart probe                                               | PASS    | Liveness 200; readiness 503 in about 4 seconds; readiness recovers to 200                                                                |
| `pnpm audit --audit-level low`                                                         | PASS    | No known vulnerabilities after the minimatch fix                                                                                         |
| `python -m uv run --locked pip-audit --local --progress-spinner off`                   | PASS    | No known vulnerabilities in the 63-package Windows project environment                                                                   |
| `python -m uv pip check --python .venv`                                                | PASS    | Project environment has no dependency conflicts                                                                                          |
| `python -m uv run --locked python scripts/check_secrets.py --include-build`            | PASS    | No selected provider-key/private-key patterns or generated development password in Git-selected source/build artifacts                   |
| Gitleaks 8.30.1, `dir <source-snapshot> --redact --no-banner`                          | PASS    | No leaks in a snapshot of Git-selected files; ignored local state excluded                                                               |
| Trivy 0.76.2, all severities, three exported final images                              | FAIL    | No language-package findings or findings with published stable-package fixes remain; unfixed OS findings remain below                    |
| Trivy `--scanners vuln --severity HIGH,CRITICAL --exit-code 1`                         | FAIL    | Exit 1 for each final image; unfixed findings are not suppressed                                                                         |
| GitHub-hosted Actions run                                                              | NOT RUN | Workflow source reviewed; no remote run/push requested; local equivalents executed; strict image gate is expected to fail                |
| Production / VPS operations                                                            | NOT RUN | No production credentials, connections, deployment, or privileged management actions used                                                |

**82 automated tests passed**: 19 Vitest + 53 backend/unit/tooling + 2 real database + 8 browser.
The final security refinement reran that aggregate suite; the integration pair was run again after
the local collation repair and its new assertion. Repeated executions are not counted as extra tests.

During the earlier follow-up, the immediate recovery assertion after PostgreSQL became healthy initially received 503: the API's
single bounded readiness worker was still completing its outage probe. A subsequent bounded recovery
probe returned 200, and runtime health passed. Recovery is eventual rather than synchronized to the
PostgreSQL container health transition; no API restart was needed. The outage checks observed live
200 in 0.03 seconds and API/proxy readiness 503 in 4.00/4.01 seconds respectively. The final security
run repeated the real database outage/recovery check: API liveness returned 200 in 0.06 seconds,
readiness returned 503 in 4.00 seconds, and bounded polling confirmed recovery without an API restart.

The original deprecation warning from Starlette's HTTPX client is resolved. Terminal color warnings
from the host are non-failing and unrelated to application behavior.

### Exact image, exposure, and local-repair commands

Run from the repository root. `Invoke-Compose` enforces the exact local environment and local Docker
socket before invoking Compose. Builds re-executed the changed runtime package layers; unchanged
builder layers were cached. These substantive verification/remediation commands supplement the full
frontend/backend command table above:

```powershell
. ./scripts/common.ps1
Invoke-Compose -ComposeArguments @('config', '--quiet')
Invoke-Compose -ComposeArguments @('--progress', 'plain', 'build')
Invoke-Compose -ComposeArguments @('up', '-d', '--wait')
./scripts/check.ps1 -Integration -Browser -Security
./scripts/smoke.ps1
python -m uv run --locked python scripts/verify_runtime.py

# Read-only local runtime exposure checks, without malicious XML or a database mutation.
Invoke-Compose -ComposeArguments @('exec', '-T', 'postgres', 'psql', '-U', 'zeaops_dev', '-d', 'zeaops_metadata_dev', '-Atc', "SELECT xmlparse(document '<zeaops/>') IS NOT NULL; SELECT DISTINCT auth_method FROM pg_hba_file_rules ORDER BY auth_method;")
Invoke-Compose -ComposeArguments @('exec', '-T', 'postgres', 'psql', '-U', 'zeaops_dev', '-d', 'zeaops_metadata_dev', '-Atc', 'SHOW krb_server_keyfile;')

# Executed only after the ignored pg_dump archive was created and pg_restore --list succeeded.
# These repaired only the existing isolated development metadata database.
Invoke-Compose -ComposeArguments @('exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'zeaops_dev', '-d', 'zeaops_metadata_dev', '-c', 'REINDEX DATABASE zeaops_metadata_dev;')
Invoke-Compose -ComposeArguments @('exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'zeaops_dev', '-d', 'zeaops_metadata_dev', '-c', 'ALTER DATABASE zeaops_metadata_dev REFRESH COLLATION VERSION;')
```

Image scans used Trivy **0.76.2**, the same severity policy as CI, and freshly exported archives.
The full scan commands exit 0 on successful inventory; each strict gate command exits **1** for
the retained findings. The exit was recorded for each image rather than treated as a passing scan:

```powershell
. ./scripts/common.ps1
Assert-LocalDocker
foreach ($role in @('api', 'web', 'postgres')) {
    $image = switch ($role) {
        'api' { 'zeaops-api:0.1.0-dev' }
        'web' { 'zeaops-web:0.1.0-dev' }
        'postgres' { 'zeaops-postgres:17.12-dev' }
    }
    Invoke-Checked -Executable docker -Arguments @('image', 'save', '--output', ".artifacts/final-security/$role.tar", $image)
    Invoke-Checked -Executable ./.tools/trivy.exe -Arguments @('image', '--cache-dir', '.artifacts/security/trivy-cache', '--input', ".artifacts/final-security/$role.tar", '--scanners', 'vuln', '--format', 'json', '--output', ".artifacts/final-security/trivy-$role.json", '--timeout', '5m')
    & ./.tools/trivy.exe image --cache-dir .artifacts/security/trivy-cache --input ".artifacts/final-security/$role.tar" --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --format json --output ".artifacts/final-security/gate-$role.json" --timeout 5m
    Write-Host "Strict gate ${role}: exit $LASTEXITCODE"
}
```

Disposable exposure inventories used `docker run --rm --network none --read-only --cap-drop ALL
--security-opt no-new-privileges --entrypoint /bin/sh ...` with `dpkg-query -W`, `find`, and `ldd`
against actual ELF binaries. `/usr/bin/psql` is a Perl wrapper; the ELF dependency check targets
`/usr/lib/postgresql/17/bin/psql`. No required shared library was missing. Separate actual commands
were `node -p process.versions.sqlite`, `python -c 'import sqlite3; print(sqlite3.sqlite_version)'`,
and `perl -MArchive::Tar -e 'print $Archive::Tar::VERSION'`, each inside the corresponding isolated
image. Expected missing-module exits in API/Web are exposure evidence, not failed application tests.

The source scan command was `./.tools/gitleaks.exe dir .artifacts/final-security/source --redact
--no-banner --report-format json --report-path .artifacts/final-security/gitleaks.json`; the snapshot
contains only Git-selected source, including untracked implementation files and excluding ignored
local state. The separate source/build check also searches for the actual generated local password
without printing it.

The local Windows scanner archives were rechecked against freshly retrieved publisher checksums;
installed executables match their verified ZIP members. CI's Linux archive checksums also match the
current publisher checksum files. Evidence is retained in `*-publisher-checksums.txt`. Docker Desktop
OCI indexes changed when build provenance was regenerated; the scanned root filesystem layer digests
match the current running images, recorded in `.artifacts/final-security/image-binding.json`.

## Remaining security findings and release decision

Trivy scanned exported image archives without mounting the Docker socket. These are package/advisory
findings, not proof that an application endpoint can exploit them; duplicates across related OS packages
are included. The refreshed scanner lists no fixed versions for the remaining findings. This does not
prove that every possible remediation or undisclosed vulnerability has been assessed. No advisory ignore
file was added. The vulnerability database was updated at **2026-11-13 00:58:46 UTC**.

| Final image | Critical | High | Medium | Low | Unknown | Unique advisory IDs | Findings with a listed stable fix | Language findings |
| ----------- | -------: | ---: | -----: | --: | ------: | ------------------: | --------------------------------: | ----------------: |
| API         |        0 |   43 |     88 |  64 |       4 |                  91 |                                 0 |                 0 |
| Web         |        0 |   42 |     83 |  63 |       4 |                  91 |                                 0 |                 0 |
| PostgreSQL  |        1 |  115 |    150 | 124 |     112 |                 192 |                                 0 |                 0 |

The PostgreSQL critical scanner finding is **CVE-2026-6653 in libxml2**
(`2.12.7+dfsg+really2.9.14-2.1+deb13u3`). Debian confirms the stable package remains vulnerable,
labels the issue minor/no-DSA, and lists fixed packages in unstable/forky. This differs from the
scanner's critical severity; it is retained for review rather than waived. The current health-only
application accepts no XML input and performs no infrastructure actions. Resolution requires a
maintained compatible backport or a patched stable base, followed by image and runtime retesting.
Mixing unstable OS packages or replacing PostgreSQL with an unverified custom server is not a safe
remediation for this bootstrap.

The strict CI image gate intentionally remains **FAIL** while these high/critical OS findings remain.
A passing package audit or functional test suite must not be described as full security release approval.

Other limits:

- ESLint 9.39.5 is deprecated upstream but retained for the current Next.js plugin peer compatibility;
  no known advisory was found. An eventual supported lint toolchain migration remains maintenance work.
- Hosted Actions has not executed. CI is configured to reproduce checks, retain redacted scanner JSON,
  and fail the strict image gate; an actual hosted run remains necessary before a remote release claim.
- This local Git repository has no commits or remote configured; the implementation files remain
  untracked. No commit, push, or remote CI trigger was performed as part of the review.
- Source and secret checks are bounded evidence, not an exhaustive proof against all secret formats,
  malicious dependencies, or undisclosed vulnerabilities. Scanner feeds change over time.
- This phase has no authentication, RBAC, TLS ingress, audit policy, or infrastructure operations.
  No fake authentication protects production actions because no such actions exist. The local database
  owner is privileged only inside this dedicated development PostgreSQL instance. Production remains NO-GO.

## Local data, runtimes, and artifacts

A custom-format local database backup was created and validated with `pg_restore --list` before the
PostgreSQL/OS image changes: `.artifacts/backups/zeaops-pre-review-patch.dump`. It contains database
schema/data, not cluster role password hashes. The existing `zeaops-dev_metadata-pg17` volume was
preserved. Disposable smoke volumes were separately named and removed. No global runtime or unrelated
project dependency was replaced; uv provisions the project Python, and scripts can use the ignored,
checksum-verified Node runtime under `.tools`.

Refreshed local image JSON is under `.artifacts/final-security/trivy-{api,web,postgres}.json`, the
strict-gate JSON under `.artifacts/final-security/gate-*.json`, and the redacted source scan under
`.artifacts/final-security/gitleaks.json`. Image archives were freshly exported; their image config
IDs match the rebuilt application images. These artifacts and the backup are ignored. CI uses pinned
Gitleaks/Trivy versions and verified Linux archive SHA-256 checksums.

No required development prerequisite is missing in the reviewed workspace. The machine-wide Node
version remains older; the scripts use the verified local Node 24.22.3 runtime. A fresh clone needs
the versions documented in the README. Network access in this review was limited to local services
and public dependency/image/advisory sources; the future production domain was not contacted.

The API builder exports production requirements from `uv.lock` and uses pip with mandatory hashes,
a bounded install timeout, and no dependency re-resolution. This replaced an observed stalled uv
TLS download path on Debian 13. Native uv sync and both final image builds succeeded.

Local services remain healthy at `http://127.0.0.1:18300` and `http://127.0.0.1:18301`.
`./scripts/dev.ps1 -Mode stop` stops this project while preserving the development database.
No native verification server is left running. Phase 2.2 has not been started.

References: [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[Node security release](https://nodejs.org/en/blog/release/v24.22.3/),
[Python security release](https://www.python.org/downloads/release/python-31410/),
[PostgreSQL 17.12](https://www.postgresql.org/docs/17/release-17-12.html),
[Debian CVE-2026-6653 status](https://security-tracker.debian.org/tracker/CVE-2026-6653).
