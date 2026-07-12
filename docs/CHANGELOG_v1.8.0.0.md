# Slimarr 1.8.0.0 Release Notes

**Release date:** 2026-07-11
**Theme:** Backend Optimization, Observability, and Frontend Premium Polish Pass

This release follows a full audit of both the backend and frontend prompted by
reports that the 1.7.1.0 replace-loop fix wasn't holding for some users. That
investigation turned up a config-default bug that silently disabled the fix
for anyone who hadn't explicitly enabled media probing; fixing it led to a
broader pass across both codebases looking for the same class of issue
(divergent config defaults, blocking event-loop calls, unbounded queries,
silent error handling) plus a UI/UX consistency pass.

## Why the replace-loop bug came back

`replace_file()` (added in 1.7.1.0) only re-probed a replaced file's
resolution/codec/bitrate when `files.enable_media_probe` was true — but that
setting defaults to `False`. Anyone who hadn't explicitly turned it on got no
benefit from the fix at all. Compounding this, the scanner's next run would
overwrite whatever *had* been corrected with Plex's own reported stream info,
which doesn't always get refreshed by a plain library scan after a file swap.

Fixed by:
- `replace_file()` now always re-probes the file it just placed (skipping
  true NAS paths unless `nas_probe_enabled`) instead of gating on the
  library-wide probing toggle — it's a single file, not a bulk scan.
- The scanner now detects when a file's size changed since its last recorded
  value (i.e. a replacement just happened) and in that case trusts the
  DB's already-probed values instead of letting a possibly-stale Plex
  read clobber them.
- Two `getattr(..., default)` fallbacks whose default value silently
  contradicted the real config schema default (`enable_media_probe` and
  `verify_after_download`) have been corrected to match.

## Backend

- **Performance:** `scan_library()` no longer blocks the event loop for the
  full scan duration — the synchronous Plex `get_all_movies()` call (which
  walks every section/movie/part over HTTP) now runs in a worker thread via
  `asyncio.to_thread`, so a large library or a slow Plex server no longer
  stalls API requests, the scheduler, and WebSocket events for the whole scan.
- **Performance:** the uploader-health lookup used during release scoring
  (`comparer.py`) opened and closed a raw SQLite connection for every
  candidate release evaluated — up to 100+ times per movie search. It now
  reuses a single connection across calls.
- **Observability:** `RadarrClient.rescan_by_imdb()` and
  `post_replace_action()` previously swallowed all failures with a bare
  `except Exception: pass`; a failed Radarr rescan/unmonitor after a
  replacement was invisible in the logs. Both now log a warning with the
  IMDb id and action involved.
- **Observability:** a downloader poll error against SABnzbd/NZBGet
  previously logged an identical warning every 5 seconds for as long as the
  client stayed unreachable. It now logs the first failure immediately, then
  backs off to a periodic reminder instead of flooding the log with repeats.
- **Observability:** the uploader-health SQLite lookup failing (locked DB,
  corrupt file) was silently swallowed with no log line at all; it now warns
  once per process instead of failing silently forever.
- **Robustness:** several list/history endpoints accepted an unbounded
  caller-supplied `limit`/`days`/`per_page` with no upper clamp
  (`/queue/recent`, `/queue/failed`, `/queue/orphaned`,
  `/dashboard/savings-history`, `/dashboard/recent-activity`,
  `/library/movies`, `/library/movies/{id}/search-results`). All now clamp to
  a sane maximum, matching the pattern already used by `/activity`.
- **Performance:** the retry ladder checked the blacklist with one DB query
  per candidate release when picking the next attempt for a failed download —
  up to dozens of queries for a movie with many accepted candidates. It now
  fetches all relevant blacklist entries in a single batched query
  (`get_blacklist_reasons()` in `blacklist.py`).
- **Safety:** `SonarrClient.unmonitor_series_by_title()` fell back to a
  15-character title-prefix match with no visibility into which series it
  picked, and no protection against two shows sharing that prefix (e.g. two
  regional versions of the same title). It now logs which candidate a fuzzy
  match resolved to, and refuses to guess (returns not-found instead of
  picking one) when the prefix is ambiguous.
- **Performance:** the orphan scanner ran two DB queries per SABnzbd/NZBGet
  history item (up to 5,000 items) to check whether a job was already
  tracked or already recorded as an orphan. It now fetches both membership
  sets once per scan and checks against them in memory.
- **Robustness:** a single malformed history entry during an orphan scan
  previously threw before the transaction committed, discarding every orphan
  already queued for that scan. Each history item is now handled
  independently, so one bad entry just gets skipped (and logged) instead of
  losing the whole batch.

## Frontend

- **Navigation bug:** the sidebar highlighted two nav items at once when
  visiting a nested route (e.g. `/queue/failed` also lit up "Queue",
  `/settings/blacklist` also lit up "Settings") because only the root `/`
  link was given exact-match routing. Fixed for all parent/child nav pairs.
- **Performance:** the Settings page recomputed its full validation pass
  (~20 numeric range checks, 6 URL checks, an indexer loop) on every
  keystroke by calling a plain function twice per render. It's now memoized
  and only recomputes when settings actually change.
- **Consistency:** unified on the shared `Skeleton`/`EmptyState` components
  in place of ad-hoc `<div>Loading…</div>` text and plain `<p>` empty-state
  messages on the Movie Detail, Settings, Activity, and Queue pages, so
  loading and empty states look the same across the app.
- **Bug fix:** the Queue page's data load had no error handling at all — a
  failed request surfaced as nothing (stale data, no feedback) instead of a
  toast; Movie Detail's and Activity's silent background-load failures got
  the same treatment.
- Removed a hardcoded "v1.7 operations center" label on the System page that
  would have read as stale the moment this release shipped.
- **Performance:** `PosterCard`, `StatCard`, and `ActivityItem` are now
  memoized (`React.memo`) so they skip re-rendering when their own props
  haven't changed — most noticeable on the Library grid and during active
  downloads on the Queue/Dashboard pages, where parent state updates
  frequently.
- **Bug fix:** the Queue page's 15s poll and its socket listeners (up to 4,
  one per download lifecycle event) could both trigger a reload at nearly the
  same time while downloads were active, firing redundant concurrent
  requests. Overlapping calls are now coalesced into a single follow-up
  refresh instead of running in parallel.
- **Consistency:** the System page mixed two different color families for
  the same "healthy/degraded/failed" concept — most of the page already used
  emerald/amber/rose, but the health-matrix and preflight-check indicators
  used a separate green/yellow/red set. Unified on the page's existing
  convention. Also normalized three slightly different translucent surface
  shades used interchangeably for the same stat-tile background
  (`bg-gray-900/70`, `/60`, `/55`) down to one.
- **Refactor:** the Dashboard's and System page's "apply NAS preset / restore
  previous profile" logic (~100 lines each, reading and writing the exact
  same `localStorage` snapshot) was duplicated between the two pages, with no
  way to notice if the two copies drifted out of sync. Extracted into a
  shared `useNasPresetManager` hook (`frontend/src/hooks/useNasPreset.ts`)
  used by both.
- **Bug fix:** the login page permanently disabled the entire form the
  moment the initial connectivity check failed (e.g. the tray app still
  starting up on first launch), with no way to recover short of a manual
  page refresh — `useAuth` now retries that check automatically every 3s
  until it succeeds, and the banner reflects that instead of telling the
  user to refresh.
- **Consistency:** unified the remaining pages still using a plain
  green/yellow/red palette instead of the app's emerald/amber/rose
  convention for the same healthy/warn/failed concepts — TV Shows,
  Container Diagnostics, Search Diagnostics, Failed Downloads, Operations,
  and the shared `TestConnectionButton` result indicator. Also swapped their
  remaining plain-text loading/empty states for the shared
  `Skeleton`/`EmptyState` components, and standardized the Blacklist page's
  "Add" button onto the same brand-green used for primary actions elsewhere.
- **Bug fix:** `ContainerDiagnostics`'s "copy docker-compose" button had no
  error handling around the clipboard write, and its data load silently
  discarded fetch failures with no user feedback; both now surface a toast.
- **Performance:** `SearchDiagnostics` recomputed several derived event lists
  from scratch on every render (including its 10s auto-refresh tick) instead
  of memoizing them, and that same 10s poll never paused while the tab was
  backgrounded (unlike Operations' equivalent poll) — both fixed.
- Removed a dead `sonarrEnabled` prop on TV Shows' `ShowRow` that was
  declared but never read, and memoized `ShowRow` itself so toggling the
  sort/filter controls doesn't re-render every row in a large show list.

## Final sweep — issues found from live logs

A last pass through several weeks of a real user's logs (through 2026-07-12,
well past this release's other fixes) turned up two more active issues:

- **Bug fix — recurring replace failure on a locked file:** one movie
  (`Toy Story 5`) failed to replace on every single nightly cycle for
  several days straight, re-downloading the same multi-GB release each time
  only to hit `[WinError 32] The process cannot access the file because it
  is being used by another process` when trying to move the existing file
  out of the way — both the recycle-bin move and the fallback backup-move
  hit the same lock and gave up immediately, failing the whole replacement.
  This is the same *shape* of bug as the original replace-loop issue (a
  persistent failure condition silently causing endless re-download) but
  with a different cause: a transient Windows file lock (something briefly
  holding the file open — AV scan, thumbnail generation, etc.) rather than
  stale metadata. `replace_file()` now retries both of those moves a few
  times with a short delay before giving up, since this class of lock
  typically clears within seconds.
- **Performance:** the System page's NAS-pressure panel counted how many
  reject reasons in the last 24h mentioned "NAS minimum" by fetching *every*
  matching `decision_audit_log.reject_reason` string into Python and
  substring-scanning them there — on a table that gets one row per candidate
  release evaluated (potentially thousands per night), this was measured
  taking up to 6.5 seconds on an endpoint the System page polls every 60s.
  Replaced with a single `SELECT count(*) ... WHERE reject_reason LIKE
  '%NAS minimum%'`, doing the filter and count in SQL instead of in Python.
- **Efficiency:** a movie whose TMDB lookup never resolves (delisted or
  mismatched `tmdb_id`) has no poster forever, so the scanner retried the
  same failing TMDB lookup on every single scan indefinitely (one specific
  movie logged 405 identical "TMDB lookup failed" warnings across 22 days in
  the reviewed logs). The scanner now backs off for 24h after a failed
  lookup instead of retrying every scan.
- Confirmed via the same logs that the 1.7.1.0 indexer-rate-limit cooldown
  and the earlier `decision_audit_log` composite index are both working
  correctly in production — the one indexer that hit sustained 429s
  triggered the cooldown as designed, and no further multi-second
  `decision_audit_log` queries of that shape appeared after this release's
  window began.
- **Consistency:** the System page mixed two different color families for
  the same "healthy/degraded/failed" concept — most of the page already used
  emerald/amber/rose, but the health-matrix and preflight-check indicators
  used a separate green/yellow/red set. Unified on the page's existing
  convention. Also normalized three slightly different translucent surface
  shades used interchangeably for the same stat-tile background
  (`bg-gray-900/70`, `/60`, `/55`) down to one.

## Verification

- Backend: full `pytest tests/backend` suite (89 tests) passes.
- Frontend: `tsc --noEmit` and a production `vite build` both pass cleanly
  with zero errors.
