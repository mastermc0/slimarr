# Slimarr v1.7.0.0 Changelog Draft

Working title: Storage-Safe Automation and Visual Refresh

This document is the living changelog draft for the next significant release.
Move items into `CHANGELOG.md` only after they are implemented and verified.

## Release Theme

v1.7 turns the NAS safety patch work from v1.6.1 into a stronger storage and
operations foundation. The release should make automation safer on network
shares, easier to recover after interruption, and clearer to understand from the
UI.

## Release Gates

- Resolve the reported NAS freeze risk before release.
- Ensure no UI polling endpoint performs repeated NAS-heavy scans by default.
- Ensure replacement, cleanup, recycle, and orphan deletion paths go through a
  shared storage-safety layer.
- Ensure automated storage operations have visible state, cancellation, and
  recovery behavior.
- Pass backend tests on a supported Python version: 3.11, 3.12, or 3.13.
- Pass frontend production build and package smoke checks.

## Planned Highlights

### NAS and Storage Safety

- Add a storage-safety service for all file operations.
- Classify paths as local, NAS/network share, download staging, recycling, or
  unknown before reads, writes, moves, or deletes.
- Add preflight checks for replacement operations: target existence, free space,
  path mapping, recycle destination, estimated bytes written, and rollback path.
- Add per-path operation locks so two jobs cannot modify the same movie folder or
  recycle target at the same time.
- Add timeout, retry, and failure classification for move/delete/recycle actions.
- Add optional NAS-safe operation budgets: maximum write bytes per window,
  maximum active storage jobs, and minimum delay after NAS failures.
- Record storage operation telemetry for diagnostics and NAS-pressure panels.
- Replace direct `shutil.move`, `shutil.rmtree`, and `os.remove` usage in
  replacement, duplicate cleanup, failed-download cleanup, and orphan cleanup.
- Initial implementation: replacement target, recycle, fallback backup, restore,
  and old-file delete paths now use the shared storage preflight/operation
  helpers.
- Initial implementation: duplicate cleanup, failed-download cleanup, orphan
  cleanup, replacement staging cleanup, and recycle-bin purge paths now route
  through shared storage operation helpers.
- Initial implementation: storage operations use per-path async locks so
  concurrent jobs cannot mutate the same source or target path at the same time.
- Initial implementation: storage operations record recent in-memory telemetry
  with operation type, status, classification, estimated bytes, duration, and
  failure details.
- Initial implementation: NAS-targeted storage operations now honor optional
  in-memory safety budgets for daily write volume, daily replacement count,
  concurrent NAS operation count, and cooldown after NAS failures.

### Persistent Jobs and Recovery

- Add a persistent job table for long-running tasks.
- Move scan, cycle, search, download monitor, replacement, duplicate preview,
  cleanup, and diagnostics bundle work into typed job records.
- Add job lifecycle states: queued, running, waiting, cancelling, cancelled,
  failed, completed, and recovery_required.
- Add heartbeats and stale-job recovery after restart.
- Add resumable replacement recovery for interrupted operations.
- Persist indexer cooldown state so rate-limit pauses survive restart.
- Add a job detail API and UI surface with task history, attempts, timestamps,
  progress, and failure reasons.
- Initial implementation: added durable `jobs` and `job_events` tables, an
  in-process job runtime, queued/running/completed/failed/cancelled/recovery
  states, heartbeat updates, startup recovery for interrupted running jobs,
  event timelines, cancellation, retry, and job APIs.
- Initial implementation: manual scans, full cycles, duplicate-preview refresh,
  duplicate cleanup, and manual scheduled-task runs now enqueue persistent job
  records.
- Initial implementation: diagnostics bundles include a job timeline snapshot,
  Prometheus exposes active and failed job metrics, and storage operation
  telemetry records the current job ID when available.

### Scan and Media Probe Improvements

- Make media probing explicitly bounded by timeout, concurrency, and NAS policy.
- Cache probe results by path, size, and modified time.
- Prefer Plex metadata when complete, and avoid opening media files when NAS-safe
  scan mode is active.
- Fix scanner config fallback behavior so missing optional config sections do not
  break tests or lightweight harnesses.
- Add scan mode presets: light, normal, deep, and NAS-safe.

### UI and Visual Fidelity

- Refresh the Dashboard, System, Settings, Queue, Library, and Movie Detail pages
  around clearer operational states.
- Replace busy panels with more deliberate status surfaces: storage safety,
  active jobs, recent decisions, and next recommended action.
- Initial implementation: System page now has a v1.7 operations-center header and
  a Storage Safety panel with a live storage preflight check.
- Initial implementation: System page now surfaces Replacement Recovery state
  with active/recovery-required counts, latest phase, redacted target/backup
  paths, and a manual refresh action.
- Initial implementation: System page includes a Persistent Jobs panel with
  recent jobs, active counts, failed/recovery-required counts, and latest job
  state.
- Add a dedicated Operations page for active jobs, storage operations, recovery
  actions, and stuck-task repair.
- Initial implementation: Operations page added at `/system/operations` with
  active and historical job tables, event timelines, cancel/retry, storage
  operation log (memory and persisted), NAS budget footer, and guarded purge.
- Improve visual hierarchy, spacing, table density, mobile behavior, empty
  states, button states, and loading skeletons.
- Add stronger icon usage for destructive, storage, NAS, retry, health, and
  recovery actions.
- Reduce repeated explanatory text in the UI and move help into contextual
  affordances.
- Add polished first-run and post-upgrade flows for NAS configuration, path
  mapping, and automation readiness.

### Visual Assets

- Create a small visual asset system for release and in-product use:
  - NAS-safe automation hero/preview image.
  - Storage operation state illustrations.
  - Empty-state images for Queue, Library, Search Diagnostics, and Operations.
  - Updated app screenshots for README and docs.
  - Optional release-banner artwork for v1.7.
- Keep assets inspectable and product-specific rather than generic decoration.
- Store generated source prompts/notes in docs so assets can be regenerated or
  updated consistently.

Initial asset added:

- `images/releases/v1.7-storage-safe-banner.png`
- `docs/assets/V1_7_VISUAL_ASSETS.md`

### Observability and Diagnostics

- Expand diagnostics bundles with storage operation history, job timeline, NAS
  classification, path mappings, and recent storage errors.
- Initial implementation: diagnostics bundles include redacted recent storage
  operation telemetry.
- Add Prometheus metrics for storage operation count, bytes moved, failed storage
  operations, job durations, and NAS cooldown state.
- Initial implementation: metrics now expose storage operation totals and
  estimated bytes by operation/status.
- Initial implementation: metrics now expose failed storage operation totals and
  whether NAS storage operations are in failure cooldown.
- Initial implementation: System health now includes storage-operation health,
  and the System page can show recent storage outcomes, NAS cooldown state,
  active NAS operations, and 24-hour NAS write/replacement counters.
- Storage-operation health warnings use a bounded recent-failure window so stale
  in-memory failures do not keep the System page degraded indefinitely.
- Persisted storage operation telemetry now records move/remove outcomes,
  classifications, timing, errors, and NAS path-health state for diagnostics
  beyond the current process.
- Replacement now writes recovery metadata before and after risky filesystem
  phases, including recycle, fallback backup, placement, restore attempts, and
  recovery-required states.
- Add trendable health snapshots for queue, storage, search, and integration
  state.
- Add correlation IDs across job, storage, search, download, and replace events.

### Configuration and Deployment

- Add environment-variable support for v1.6.1 and v1.7 NAS/storage settings.
- Add config validation warnings for dangerous combinations, such as recycle bin
  on NAS plus aggressive replacement throughput.
- Add Docker and Windows guidance for NAS path mapping and safe defaults.
- Add a supported-Python check that warns on Python 3.14 until dependencies
  officially support it.

### Data and Migration Foundation

- Add a migration revision ledger or adopt a versioned migration tool.
- Keep SQLite as default while preserving optional PostgreSQL support.
- Add indexes for job, storage operation, and telemetry timelines.
- Add cleanup/retention rules for high-volume diagnostic history.

### Cleanup and Code Health

- Remove or implement unused configuration such as `files.verify_after_download`.
- Review underused movie fields such as `source_type`, `total_savings`, and
  `times_replaced`.
- Replace scattered filesystem helpers with shared path, storage, and redaction
  utilities.
- Move historical logs and packaged artifacts out of source-controlled docs where
  practical.
- Add tests for NAS path classification, storage preflight, rollback behavior,
  duplicate-preview caching, and job recovery.

## Known 1.6.1 Issues To Close

- NAS freeze risk is being reduced by routing replacement, duplicate cleanup,
  failed-download cleanup, orphan cleanup, replacement staging cleanup, and
  recycle-bin purge paths through the shared storage layer. Remaining work:
  soak testing on a real SMB/NAS path.
- System page duplicate cleanup preview previously touched Plex/NAS paths on a
  45-second interval; this has been changed for v1.7 so refreshes are
  manual/cached.
- Plex refresh after replacement now falls back to all movie sections when no
  explicit library sections are configured.
- Backend scanner media-probe regression from the local audit environment has
  been fixed.
- The project venv used during audit reported Python 3.14.4, while the supported
  matrix is Python 3.11 to 3.13.

## Release Notes Skeleton

Use this section when preparing the final `CHANGELOG.md` entry.

```markdown
## [1.7.0.0] - YYYY-MM-DD

### Storage-safe automation and visual refresh

#### NAS and storage safety

- ...

#### Persistent jobs and recovery

- ...

#### UI and visual polish

- ...

#### Diagnostics and deployment

- ...

#### Fixes

- ...
```
