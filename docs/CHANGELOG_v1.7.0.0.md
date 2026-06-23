# Slimarr 1.7.0.0 Release Notes

**Release date:** 2026-06-23
**Theme:** Storage-Safe Automation and Persistent Jobs

This is a significant release focused on making NAS-backed libraries safe to
automate, giving long-running work a durable, recoverable home, and starting
a consistency pass on the UI. See `CHANGELOG.md` for the complete, dated
changelog across all releases; this document is the standalone summary for
1.7.0.0.

## Headline fix: NAS freeze/crash during replacement

Some users on NAS-backed libraries reported the app appearing to freeze or
crash during file replacement. The root cause has been identified and fixed:

`replace_file()` — the function that swaps a downloaded file into your Plex
library — was calling `shutil.disk_usage()`, `os.makedirs()`,
`os.path.exists()`/`getsize()`/`isdir()`, and a recursive `os.walk()`
directly on the asyncio event loop instead of through a worker thread. On a
slow, busy, or sleeping NAS share, any one of those calls can block for
seconds. Because they ran on the event loop, that block stalled the **entire
app** — API requests, the websocket connection, and the scheduler — for the
duration. From the outside, that looks exactly like a freeze or crash.

Every blocking filesystem call in the replacement and duplicate-cleanup paths
now runs on a worker thread, matching the pattern already used elsewhere in
the NAS-safety code. Regression tests (`tests/backend/test_replacer_event_loop.py`)
assert the event loop keeps making progress while these calls are in flight,
rather than just trusting the call site.

## Storage safety and persistent jobs

- A shared storage-safety layer (`backend/core/storage.py`) now handles path
  classification (local / NAS / network / recycling), preflight checks
  (existence, parent accessibility, free space), per-path locks, and optional
  NAS budgets: max write bytes/day, max replacements/day, max concurrent
  operations, and a cooldown after failures.
- Replacement, duplicate cleanup, failed-download cleanup, orphan cleanup,
  download-staging cleanup, and recycling-bin purges all route through this
  shared layer instead of raw `shutil`/`os` calls.
- Storage operation telemetry (recent moves/deletes, failures, durations,
  classifications) is now persisted to the database, surviving restarts, and
  exposed via Prometheus metrics, diagnostics bundles, and the System and
  Operations pages.
- A persistent job runtime (`jobs` / `job_events` tables) now backs manual
  scans, full automation cycles, duplicate preview/cleanup, and scheduled
  tasks, with heartbeats, stale-job recovery on restart, and cancel/retry
  APIs.
- Replacement recovery metadata is recorded before and after each risky
  filesystem phase (recycle original, backup existing target, place new
  file, restore on failure), so an interruption mid-replacement is visible
  and recoverable instead of silently leaving the library half-updated.
- A new Operations page (`/system/operations`) shows active and historical
  jobs, job event timelines, the storage operation log, NAS budget status,
  and guarded cancel/retry/purge actions.

## UI consistency pass

- Unified destructive-action confirmation on one shared `ConfirmDialog`
  component: TV show delete (previously a one-off modal), blacklist entry
  removal, and orphaned-download cleanup (both previously fired immediately
  on click with no confirmation at all), plus the System page's recycling
  purge and duplicate cleanup (previously native `window.confirm`).
- Added shared `Skeleton` and `EmptyState` components and applied them
  consistently across Library, Queue, Operations, Orphaned Downloads, and
  Blacklist.
- Added a `StorageStateMark` component that maps replacement-recovery phase
  strings (preflight, recycling, backing up, placing, restoring, failed,
  recovery-required) to a consistent icon and color on the System page,
  instead of showing raw internal phase strings like `place_replacement_started`.
- Added a responsive mobile navigation drawer and reduced-motion support.

## Implemented `files.verify_after_download`

This setting previously had no effect at all, despite defaulting to `true`
and printing a startup warning on every install ("not yet implemented").
It's now real: a downloaded file is rejected before it replaces a working
library copy if it's empty/zero-byte, and — when `files.enable_media_probe`
is also enabled — a warning is logged if no usable video stream is detected
(this does not hard-block, since probing can be flaky on some containers).

## Security and code-health

- Removed several silent `except Exception: pass` blocks in the Plex
  integration and login-lockout audit path; failures are now logged.
- Added an identifier allowlist before table/column names are interpolated
  into SQLite migration DDL (defense-in-depth; these are hardcoded today,
  not exploitable, but the pattern is now safe if that ever changes).
- Added a startup warning when `server.allowed_origins` includes `*`. Risk
  is lower than typical wildcard-CORS setups because `allow_credentials` is
  `False` (no cookies sent cross-origin), but a leaked bearer token could
  still be used from any origin, so it's now surfaced instead of silent.
- Removed an accidentally committed 6MB log archive and a diagnostics
  history file from `docs/logs-new/`, and tightened `.gitignore`.

## Docker / deployment documentation

`docs/DOCKER.md` previously only documented the pre-1.6.1 environment
variables and metrics. It now covers:

- All NAS-safety environment variables (`SLIMARR_NAS_PATH_PREFIXES`,
  `SLIMARR_NAS_MAX_WRITE_GB_PER_DAY`, `SLIMARR_NAS_MAX_REPLACEMENTS_PER_DAY`,
  `SLIMARR_NAS_MAX_CONCURRENT_OPERATIONS`, `SLIMARR_NAS_FAILURE_COOLDOWN_MINUTES`,
  `SLIMARR_NAS_MAX_TRANSFER_MBPS`, `SLIMARR_NAS_COPY_CHUNK_MB`,
  `SLIMARR_MIN_SAVINGS_MB_FOR_NAS`, `SLIMARR_MIN_CYCLE_INTERVAL_MINUTES`,
  `SLIMARR_MAX_DOWNLOADS_PER_NIGHT`, `SLIMARR_THROTTLE_SECONDS`,
  `SLIMARR_MAX_ACTIVE_DOWNLOAD_HOURS`).
- `SLIMARR_DB_URL` and PostgreSQL pool-tuning variables.
- The six Prometheus metrics added alongside persistent jobs and storage
  telemetry (`slimarr_jobs_active`, `slimarr_jobs_failed_total`,
  `slimarr_nas_cooldown_active`, `slimarr_nas_storage_operations_active`,
  `slimarr_storage_operations_total`, `slimarr_storage_operation_bytes_total`,
  `slimarr_storage_operation_failures_total`).
- A pointer to the System page's NAS Pressure panel and the non-mutating
  `GET /api/v1/system/storage/preflight` check.

`.env.example`, `config.yaml.example`, and all three Docker Compose variants
(`docker-compose.yml`, `docker-compose.postgres.yml`, `docker-compose.traefik.yml`)
already forwarded these settings correctly — only the prose documentation
was out of date.

## Windows installer build fixes

While rebuilding the 1.7.0.0 installer, two real build-script bugs surfaced
and were fixed:

- `build-installer.ps1` regenerated `config.yaml.example` from a hardcoded
  copy embedded in the script on every build, which had drifted from the
  real file — it was missing all NAS budget settings and set
  `enable_media_probe: true` (the unsafe default). The script now verifies
  the source-controlled file instead of overwriting it.
- The documented setup path (`install.ps1`) never actually installed
  `pystray`/`pillow`/`pywin32`, even though `slimarr.spec` requires them as
  PyInstaller hidden imports for the tray icon. Added `requirements-tray.txt`
  and wired it into `install.ps1` on Windows.
- `build-installer.ps1` only looked for "Inno Setup 6" in its installer
  detection; it now also finds Inno Setup 7.

## Verification

- Backend: 93 tests pass on Python 3.12 (`pytest tests/`), including 12 new
  tests covering the event-loop fix, the SQL identifier guard, the
  verify-download logic, and the CORS wildcard warning.
- Frontend: `tsc` typecheck and `vite build` production build both pass
  cleanly with zero errors.

## What's not in this release

The deeper visual redesign of Dashboard, Library, Movie Detail, and Settings,
plus new bitmap release/empty-state artwork (roadmap Phases 4-5 in
`docs/VERSION_1_7_ROADMAP.md`), are still in progress and will ship in a
follow-up release rather than being claimed here.

## Docker image

The Dockerfile (`python:3.12-slim` runtime, multi-stage frontend build) was
reviewed for correctness but **not built locally for this release** — Docker
isn't installed in the environment this release was prepared in. Build and
push it the usual way before publishing:

```bash
docker build -t ghcr.io/theantipopau/slimarr:1.7.0.0 -t ghcr.io/theantipopau/slimarr:latest .
docker push ghcr.io/theantipopau/slimarr:1.7.0.0
docker push ghcr.io/theantipopau/slimarr:latest
```

## Upgrade notes

- No manual migration steps. SQLite/PostgreSQL schema additions are additive
  and applied automatically on startup.
- If `files.verify_after_download` was already set to `true` in your config
  (the default), it now actually does something — see above. No action
  needed unless you want to disable it.
- If you rely on `server.allowed_origins: ["*"]`, you'll see a new startup
  warning. It's informational; nothing is blocked.
