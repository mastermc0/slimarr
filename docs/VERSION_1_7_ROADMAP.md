# Slimarr v1.7 Roadmap

Slimarr v1.7 should be a significant release, not just a larger patch. The
primary goal is to make storage automation trustworthy on NAS-backed libraries,
then use that foundation to improve the product feel, operational clarity, and
long-term maintainability.

## Release Principles

- NAS safety is the release blocker.
- Long-running work should be visible, cancellable, and recoverable.
- UI surfaces should explain what Slimarr is doing without overwhelming the user.
- Direct filesystem mutation should happen through one tested storage layer.
- Visual polish should support confidence and clarity, not decoration.
- SQLite remains the simple default; advanced internals should stay additive.

## Phase 0: Stabilize v1.6.1 Before Bigger Work

### Goals

- Remove known release-readiness failures.
- Stop the most avoidable NAS pressure immediately.
- Create a safer baseline before changing orchestration.

### Tickets

- Done: fix scanner media-probe test by handling missing `config.files`
  defensively.
- Run backend tests on Python 3.11, 3.12, or 3.13, not Python 3.14.
- Done: disable automatic duplicate-preview polling on System and make preview
  data manual/cached.
- Done: make maintenance insights use cached duplicate-preview telemetry instead
  of triggering a fresh Plex scan every call.
- Done: add a startup warning when Python is outside the supported range.
- Done: add environment-variable mappings for existing NAS settings:
  `files.enable_media_probe`, `files.nas_path_prefixes`,
  `comparison.min_savings_mb_for_nas`, `schedule.min_cycle_interval_minutes`,
  `schedule.max_downloads_per_night`, and `schedule.throttle_seconds`.

## Phase 1: Storage Safety Engine

### Goals

- Centralize all read/write/delete/move behavior.
- Make risky operations inspectable before they happen.
- Protect NAS devices from repeated or concurrent heavy operations.

### Core Design

Add `backend/core/storage.py` or a `backend/storage/` package with these
responsibilities:

- Normalize and classify paths.
- Apply Plex path mappings consistently.
- Detect configured NAS prefixes.
- Calculate operation plans.
- Enforce path locks.
- Enforce NAS budgets and cooldowns.
- Execute moves/deletes/recycle operations with bounded retries.
- Persist operation telemetry.

### Suggested Models

- `storage_operations`
  - `id`
  - `operation_type`
  - `source_path`
  - `target_path`
  - `classification`
  - `estimated_bytes`
  - `actual_bytes`
  - `status`
  - `error_message`
  - `started_at`
  - `completed_at`
  - `job_id`
- `storage_path_health`
  - `path_prefix`
  - `classification`
  - `last_success_at`
  - `last_failure_at`
  - `failure_count`
  - `cooldown_until`

### Tickets

- Done: add path classification helper with unit tests.
- Done: add initial storage preflight helper and API for future replacement and
  cleanup operations.
- Done: replace `backend/core/replacer.py` library-file moves/deletes with
  storage service calls and preflight checks.
- Done: add per-path async locks around storage move/delete operations.
- Done: replace duplicate cleanup direct moves/deletes with storage service
  calls.
- Done: replace failed-download and orphan cleanup direct deletes with storage
  service calls.
- Done: move replacement download-staging cleanup through the storage service.
- Done: move recycling-bin manual purge and scheduled purge deletes through the
  storage service.
- Done: add in-memory storage operation telemetry for recent move/delete
  outcomes, failures, duration, classification, and estimated bytes.
- Done: expose storage operation metrics through the Prometheus metrics endpoint.
- Done: include redacted storage operation history in diagnostics bundles.
- Done: expose recent storage operation telemetry and NAS cooldown state through
  a System API endpoint and health-matrix component.
- Done: bound storage health degradation to recent storage failures instead of
  any failure retained in memory.
- Done: add an initial in-memory NAS budget policy:
  - max bytes written per 24 hours
  - max replacements per 24 hours
  - max concurrent storage operations
  - cooldown after failed NAS operation
- Done: add rollback and recovery metadata for interrupted replacement.
- Done: add persisted operation telemetry and path-health records for history
  beyond the current process.

## Phase 2: Persistent Job Runtime

### Goals

- Move fragile in-memory task tracking into persistent state.
- Give the UI one source of truth for active and historical work.
- Survive process restart without losing context.

### Core Design

Create a small in-process job runtime first. It can later become a separate
worker process if needed.

### Suggested Models

- `jobs`
  - `id`
  - `kind`
  - `status`
  - `priority`
  - `payload`
  - `progress_current`
  - `progress_total`
  - `heartbeat_at`
  - `attempt`
  - `max_attempts`
  - `error_message`
  - `created_at`
  - `started_at`
  - `completed_at`
  - `cancel_requested_at`
- `job_events`
  - `id`
  - `job_id`
  - `event`
  - `message`
  - `details`
  - `created_at`

### Tickets

- Done: add job models and additive migrations.
- Done: add `JobRuntime` with enqueue, start, heartbeat, cancel, and recover.
- Done: route manual scan through job runtime.
- Done: route full cycle through job runtime.
- Done: route duplicate preview and cleanup through job runtime.
- Defer: route diagnostics bundle creation through job runtime where practical.
- Persist direct indexer cooldowns.
- Done: add stale-job recovery on startup.
- Done: add job APIs:
  - `GET /api/v1/jobs`
  - `GET /api/v1/jobs/{id}`
  - `POST /api/v1/jobs/{id}/cancel`
  - `POST /api/v1/jobs/{id}/retry`

## Phase 3: NAS-Aware Replacement Workflow

### Goals

- Make replacement safe, resumable, and transparent.
- Reduce probability of leaving the library in a half-updated state.

### Desired Flow

1. Resolve original Plex path through path mappings.
2. Classify original, target, recycle, and download paths.
3. Preflight storage plan.
4. Reserve NAS budget.
5. Move original to recycle or local fallback.
6. Move new file into place.
7. Verify target exists and expected size is plausible.
8. Commit DB activity and operation state.
9. Refresh Plex/Radarr using scoped refresh where possible.
10. Clean download staging through storage service.

### Tickets

- Add replacement plan object.
- Add replacement preflight endpoint and UI summary.
- Add scoped Plex refresh fallback when no configured sections exist.
- Add replacement recovery command for operations stuck after restart.
- Add tests for extension changes, recycle failures, cross-volume moves, missing
  original file, failed target move, and rollback.

## Phase 4: UI and Visual Fidelity Refresh

### Goals

- Make Slimarr feel calmer, more deliberate, and more mature.
- Show operational truth clearly: what is safe, what is running, what needs
  attention, and what the next action is.

### Product Direction

Slimarr is an operational media tool, not a marketing site. The UI should be
dense enough for repeated use, but warmer and clearer than raw admin panels.
The best visual direction is restrained, cinematic, and utility-first:

- strong hierarchy
- compact cards only where they represent repeated entities
- fewer nested panels
- better empty/loading/error states
- consistent action bars
- clearer destructive-action affordances
- visible progress for long operations

### Tickets

- Done: create an Operations page for jobs and storage operations.
- Started: redesign System as a health and recovery center with v1.7 operations
  framing and a Storage Safety panel.
- Started: surface replacement recovery metadata on System so interrupted or
  recovery-required replacements are visible before the full Operations page is
  introduced.
- Redesign Dashboard around: automation readiness, active work, NAS/storage
  state, recent savings, and next recommended action.
- Improve Library with better density controls, filter chips, sort controls, and
  scan state.
- Improve Movie Detail with clearer compare reasoning, quality intent, preferred
  release, and replacement preflight.
- Improve Settings with grouped navigation, validation summaries, and safer NAS
  defaults.
- Add loading skeletons for Dashboard, Library, System, and Movie Detail.
- Add empty states for Queue, Search Diagnostics, Operations, and Blacklist.
- Add a destructive-action confirmation pattern that is consistent across purge,
  cleanup, orphan delete, and TV delete.
- Add responsive QA pass for narrow desktop and mobile.

## Phase 5: Visual Asset System

### Goals

- Create product-specific visual assets that make the app feel more complete.
- Avoid generic stock-like decoration.
- Keep assets maintainable and regenerable.

### Asset Candidates

- Done: v1.7 release banner concept for storage-safe automation theme.
- Dashboard screenshot refresh after UI redesign.
- System/Operations screenshot showing active storage jobs.
- NAS-safe setup illustration for first-run flow.
- Empty-state images:
  - no active jobs
  - no search diagnostics
  - no failed downloads
  - no library results
- Small visual marks for storage states:
  - preflight
  - moving
  - verifying
  - recovery required
  - NAS cooldown

### Asset Guidelines

- Use bitmap assets for rich illustrations and release banners.
- Use existing icon library for UI controls and status symbols.
- Keep screenshots real and current.
- Store generated prompts and source notes under `docs/assets/` or
  `images/source-notes/`.
- Export web-optimized PNG/WebP assets.

## Phase 6: Observability and Supportability

### Goals

- Make support cases easier to diagnose.
- Make performance and storage pressure visible over time.

### Tickets

- Done: add redacted storage operation history to diagnostics bundle.
- Done: add job timeline to diagnostics bundle.
- Done: add NAS classification and path mapping summary to diagnostics bundle.
- Done: add recent storage errors and recovery-required job state to the health
  matrix.
- Add metrics:
  - Done: `slimarr_storage_operations_total`
  - Done: `slimarr_storage_operation_bytes_total`
  - Done: `slimarr_storage_operation_failures_total`
  - Done: add `slimarr_jobs_active`
  - Done: `slimarr_jobs_failed_total`
  - Done: `slimarr_nas_cooldown_active`
- Done: add retention settings for job events and diagnostics history (30-day
  scheduler job + manual purge endpoint).

## Phase 7: Migration and Code Health

### Goals

- Reduce old code paths and remove ambiguous ownership.
- Prepare for larger releases without startup migration sprawl.

### Tickets

- Add migration revision ledger or adopt Alembic.
- Done: add schema version to system info/diagnostics.
- Audit unused fields and config values:
  - `files.verify_after_download`
  - `Movie.source_type`
  - `Movie.total_savings`
  - `Movie.times_replaced`
- Move historical logs and bulky release artifacts out of source-controlled docs.
- Consolidate path normalization helpers.
- Consolidate JSON parsing helpers for model response conversion.
- Add static API contract coverage for new job and storage endpoints.

## Suggested Milestones

### 1.7.0-alpha1

- Duplicate-preview polling fixed.
- Storage path classification and preflight implemented.
- Replacement uses storage service for the main file operation path.
- Replacement target/recycle/backup/delete operations use storage preflight and
  async storage wrappers.
- Duplicate, failed-download, orphan, staging, and recycle cleanup paths use
  storage wrappers.
- System page exposes storage safety status and a live storage preflight check.
- System page exposes replacement recovery state from persisted replacement
  metadata.
- Scanner test fixed and supported Python test pass restored.

### 1.7.0-alpha2

- Persistent job runtime introduced.
- Scan, cycle, manual scheduled-task runs, duplicate preview, and duplicate
  cleanup route through jobs.
- Done: System page exposes persistent job history and links to the dedicated
  Operations page.
- Diagnostics bundle includes jobs and storage operations.

### 1.7.0-beta1

- NAS budgets and cooldowns available for configured NAS paths.
- Replacement recovery flow implemented.
- System and Dashboard visual refresh complete.
- Docker/env config parity complete.

### 1.7.0-rc1

- Full backend test suite passing on supported Python.
- Frontend build passing.
- Package smoke test complete.
- NAS stress/soak test complete.
- Final screenshots and release assets updated.

## Validation Plan

- Unit tests for storage classification, path mapping, preflight, and budget
  policy.
- Unit tests for replacement rollback and recovery decisions.
- API tests for job lifecycle and storage-operation endpoints.
- Integration-style tests with temporary directories for move/delete/recycle
  behavior.
- Manual NAS-safe test plan using a mapped drive or SMB share:
  - light scan
  - full cycle with one replacement
  - interrupted replacement
  - duplicate preview
  - recycle purge
  - orphan cleanup
- Frontend visual pass:
  - desktop 1440px
  - laptop 1280px
  - tablet/narrow 768px
  - mobile 390px

## Out Of Scope Unless Time Allows

- Redis or external worker queue.
- Multi-node worker deployment.
- Full ffprobe parity for every stream dimension.
- Large plugin ecosystem work.
- Native mobile app.
