# Slimarr 1.9.0.0 Release Notes

**Release date:** 2026-07-20
**Theme:** Full Codebase Review, Config Correctness, and Navigation Rework

This release started as a full read-through of both codebases — every core
pipeline module, every page, the test suite, and a live boot of the app —
looking for anything that didn't do what it claimed to do. That turned up a
config section that had been silently dead since it was written, a database
mode that was never actually turned on, and a handful of smaller correctness
bugs. A second pass then worked through the resulting list, plus a sidebar
navigation rework pulled forward from the 2.0 roadmap.

## Why `exclusions:` is the headline fix

`config.yaml`'s `exclusions:` section (movie IDs, title keywords, folders,
codecs, resolutions, a minimum file size, a maximum library age) is fully
defined, validated, and already round-trips through the Settings API — but
no code anywhere ever read it. Every movie in the Plex library, including
non-commercial media that happens to live in the same section (home videos,
wedding films, family recordings), was being turned into a search query and
sent to every configured Usenet indexer on every cycle, with no way to opt
out short of removing the item from Plex entirely.

Fixed by:
- A new `backend/core/exclusions.py` with a single `is_movie_excluded()`
  check, called in `orchestrator.process_single_movie()` *before* a search
  is issued — an excluded movie's title is never sent to an indexer.
- A new `movies.added_at` column (populated from Plex's own `addedAt`) to
  back the `maximum_age_days` rule, which needed a real timestamp to mean
  anything.
- A full Exclusions section in the Settings UI, since a config option nobody
  can find in the app is nearly as useless as one that doesn't work.

## Why the SQLite lock errors happened

SQLite defaults to its rollback-journal mode, where a write holds an
exclusive lock on the whole database file for its duration. Under any
concurrent access — a library scan running while a download status update
lands, for instance — a second writer hits `OperationalError: database is
locked` instead of waiting. This showed up repeatedly in production logs as
failed `INSERT INTO downloads` statements. WAL (write-ahead logging) mode
lets readers and a single writer proceed concurrently instead of blocking on
the same exclusive lock, and is the standard fix for this exact failure
mode; it's now set (along with a 30s busy-timeout as a second line of
defense, and `synchronous=NORMAL`, WAL's recommended pairing) on every
connection at engine-connect time.

## Backend

- **Correctness:** `Movie.source_type` — read by the comparer's
  source-quality upgrade checks and local media-health scoring — was never
  written by anything, so it was always empty and those checks were
  comparing against nothing. The replacer now sets it from the actual
  release title on a successful replacement (the strongest signal available
  — you already know exactly what was grabbed); the scanner fills in a
  filename-based guess for movies Slimarr hasn't touched yet.
- **Performance / correctness:** uploader-health scoring
  (`comparer._uploader_health_score()`) opened a synchronous SQLite
  connection and ran a query once per *candidate release* — up to 100+
  times for a single movie search — directly on the event loop thread, and
  had no PostgreSQL implementation at all (silently returning the neutral
  default for every uploader on that backend). Replaced with
  `downloader.get_uploader_health_scores()`, one batched async query for a
  whole search's candidates, run through the normal engine so it works on
  either database. The old per-call path remains as a fallback for direct
  callers (tests, one-off scripts).
- **Observability:** the rate-limit toast on the frontend matched an exact
  warning message string, so only one of the two code paths that actually
  emit a rate-limit warning ever triggered it. Every `search:warning` event
  now carries a stable `code` field (`rate_limited`, `search_not_configured`,
  `search_degraded`, `zero_results_streak`, `search_failing`,
  `indexer_category_mismatch`); the frontend matches on that instead.
- **Correctness:** `tv.py` swallowed the Plex exception on a failed show
  list without logging it, and both TV endpoints used the deprecated
  `asyncio.get_event_loop()` pattern. Both now log with context and use
  `asyncio.to_thread`.
- Removed `comparer.rank_candidates()`, an unused function that silently
  dropped quality-intent and override parameters — a trap for any future
  caller who found it and assumed it was the "real" ranking path.
- New `GET /api/v1/queue/summary` endpoint: three `COUNT(*)` queries for
  active/failed/orphaned downloads, for the sidebar badges below — avoids
  fetching full download/orphan lists just to show how many there are.

## Frontend

- **Consistency:** the same file size showed different numbers on different
  pages — `Dashboard.formatGB` divided by 1e9 (decimal GB), `PosterCard`'s
  divided by 2^30 (binary GB), and at least eight other pages had their own
  hand-rolled version of one or the other. A shared `frontend/src/lib/format.ts`
  (`formatBytes`, `formatGB`, both 1024-based) now backs every size shown in
  the app.
- **Navigation rework:** the sidebar's 13 flat links are now grouped into
  Library, Activity, System, and Settings sections (matching the 2.0
  roadmap's proposed grouping), with Dashboard standing alone at the top.
  Failed Downloads and Orphaned Downloads keep their own pages, but now show
  a live badge count (red/amber) next to the link, and Queue shows an active
  count — all backed by the new `/queue/summary` endpoint, polled and
  refreshed on download lifecycle socket events.
- **Consistency:** the Tailwind `brand.green` token was a leftover Material
  green (`#4CAF50`) that the UI hadn't actually used in a long time — every
  gradient, glow, and status accent already used the emerald/teal
  `--accent` (`#1fbf8f`). Updated the token to match what was already there
  instead of the much larger job of touching every individual usage.
- **Offline installs:** `index.css` pulled the UI font from Google Fonts on
  every page load, which blocks or falls back to a system font on
  air-gapped/offline homelab installs. Downloaded and self-hosted the
  official OFL-licensed variable-font files instead (license included).
- Replaced the last native `window.confirm()` (the System page's
  preflight-warning gate) with the app's own styled `ConfirmDialog`,
  including a proper non-destructive variant and a formatted warning list
  instead of a newline-joined string that would have rendered as one run-on
  sentence in a native browser dialog.

## Verification

- Backend: full `pytest tests` suite (108 tests, up from 93 at the start of
  this review) passes, including 15 new tests covering exclusions, uploader
  health batching, and the source-type scanner fallback.
- Frontend: `tsc --noEmit` and a production `vite build` both pass cleanly.
- Manually verified in a real logged-in session against an isolated
  throwaway database (registration flow, dashboard, settings save/reload
  including the new Exclusions section, sidebar grouping and live badge
  counts, unified brand color) — not just build/type-check success.
