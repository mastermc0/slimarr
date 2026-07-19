# Slimarr 2.0 Roadmap

Drafted 2026-07-19 from a full code review of 1.8.0.0 (93/93 backend tests passing,
frontend type-check clean, app boots and serves cleanly).

---

## Guiding idea for 2.0

1.x earned trust for **movies**: safe replacement, recovery records, NAS guards,
observability. 2.0 should do two things: **extend the same engine to TV episodes**
(where most libraries hold the real bloat) and **make automation something you can
watch and steer** (plan → preview → approve → undo), instead of something that just
happens overnight.

---

## 0. Pre-2.0 fixes (ship in a 1.8.x patch — these are real bugs today)

**Status: done, 2026-07-19.** Items 1–4 and 6–9 are implemented and merged into
this branch (103/103 backend tests passing, frontend `tsc` clean, production
build verified). Item 5 (naive/aware datetime standardization) is intentionally
deferred — it touches every model and write path, so it belongs in its own
focused pass rather than riding along with this batch.

| # | Issue | Where | Impact | Status |
|---|-------|-------|--------|--------|
| 1 | **SQLite WAL mode is never enabled.** `database_runtime_info()` reports `wal_enabled` but nothing ever executes `PRAGMA journal_mode=WAL` / `busy_timeout`. Production logs (`docs/logs3.md`) show ~471 `OperationalError: database is locked` failures on `INSERT INTO downloads`. | `backend/database.py` | Failed grabs, retry churn | ✅ Fixed — `connect` event listener sets WAL + busy_timeout=30s + synchronous=NORMAL |
| 2 | **`exclusions:` config is dead code.** `ExclusionConfig` (movie_ids, title_keywords, folders, codecs…) is defined but never read anywhere. Result: personal home videos ("Caitlyn & Matt's Wedding Film") are sent as search queries to public Usenet indexers — privacy leak + wasted API quota, every cycle. | `backend/config.py:150`, scanner/orchestrator | Privacy, quota | ✅ Fixed — new `backend/core/exclusions.py`, checked in `orchestrator.process_single_movie()` before search runs; added `movies.added_at` (from Plex) for the `maximum_age_days` rule; full Settings UI section added |
| 3 | **`Movie.source_type` is never populated.** The comparer's intent gates (`source_rank_candidate >= source_rank_local`) and local media-health scoring read it, but no code ever writes it, so the local file's source is always "unknown". Infer it during scan from the file name (`parse_release_title` on the basename) and from the release title recorded at replacement time. | `backend/core/scanner.py`, `replacer.py` | Weakens upgrade decisions | ✅ Fixed — replacer sets it from the actual release title (authoritative); scanner fills in a filename-based guess for movies never yet replaced |
| 4 | **Rate-limit toast matches prose, not a code.** `Layout.tsx` fires the toast only for the exact string `"Indexer API quota or rate limit reached."`; the searcher's variant (`"…; pausing this indexer temporarily."`) never toasts. Emit a machine-readable `code` field on `search:warning` and match on that. | `frontend/src/components/Layout.tsx:23`, `backend/core/searcher.py:189` | Silent quota exhaustion | ✅ Fixed — `emit_search_warning(..., code=...)` on every call site (`rate_limited`, `search_not_configured`, `search_degraded`, `zero_results_streak`, `search_failing`, `indexer_category_mismatch`); Layout.tsx matches on `code` |
| 5 | **Mixed naive/aware datetimes.** Columns are `DateTime` (naive) but many writes use tz-aware `datetime.now(timezone.utc)` while `replacer.py` deliberately strips tzinfo. SQLite tolerates this; asyncpg/PostgreSQL will not. Standardize on naive-UTC helpers (or `DateTime(timezone=True)` everywhere) before Postgres is advertised. | `backend/database.py`, models | Postgres correctness | ⏸ Deferred — cross-cutting, needs its own pass |
| 6 | **Dead/unsafe `rank_candidates()`.** Never called, and it drops quality-intent/overrides if anyone ever does call it. Delete it. | `backend/core/comparer.py:715` | Trap for future code | ✅ Fixed — removed |
| 7 | **GB vs GiB inconsistency.** `Dashboard.formatGB` divides by 1e9, `PosterCard.formatGB` by 1 GiB — both label it "GB", so the same file shows different sizes on different pages. One shared formatter in `lib/format.ts`. | frontend | User confusion | ✅ Fixed — `frontend/src/lib/format.ts` (`formatBytes`, `formatGB`, both 1024-based); every page/component migrated |
| 8 | **TV endpoints swallow errors.** `tv.py` catches the Plex exception and raises `service_unavailable` without logging it; also uses deprecated `asyncio.get_event_loop()`. | `backend/api/tv.py:74-78` | Debuggability | ✅ Fixed — logs the error before raising; both spots switched to `asyncio.to_thread` |
| 9 | **Google Fonts CDN import.** `index.css` pulls Space Grotesk from Google — offline/isolated homelabs get a blocking request + fallback font. Self-host the woff2 in `frontend/src/assets/`. | `frontend/src/index.css:1` | Offline installs, privacy | ✅ Fixed — self-hosted variable-font woff2 (latin + latin-ext, OFL-1.1 license included) in `frontend/src/assets/fonts/` |

### Also done in this pass (UI quick wins from section 5, pulled forward)

- Replaced the last `window.confirm` (System.tsx preflight-warning gate) with the
  app's styled `ConfirmDialog`, including a proper non-destructive variant and a
  formatted warning list instead of a `\n`-joined string.

### Second pass, 2026-07-20 — more bug fixes + UI section 5 quick wins

- **Fixed:** `comparer._uploader_health_score()` ran a synchronous `sqlite3` query
  on the event loop once per candidate (dozens–100+ times per movie search) and
  silently returned the 0.5 default for every uploader on PostgreSQL. Added
  `downloader.get_uploader_health_scores()` — one batched async query per search,
  backend-agnostic — and threaded a `uploader_health_score` param through
  `compare_release()`; `searcher.py` now pre-fetches the whole candidate batch's
  scores before the compare loop. The old sync path stays as a fallback for
  direct/test callers. Covered by `tests/backend/test_uploader_health.py`.
- **Sidebar navigation regrouped** (roadmap 5.1): 13 flat links → Dashboard +
  4 labeled groups (Library, Activity, System, Settings). Added a real
  `GET /queue/summary` endpoint (counts-only, no full list fetch) and live badge
  counts on Queue/Failed Downloads/Orphaned Downloads, polled + refreshed on
  `download:*` socket events. Kept Failed/Orphaned as their own routes rather
  than merging into Queue's page — that's a bigger, harder-to-verify page-merge
  refactor than this pass should risk.
- **Brand color unified** (roadmap 5.2, partial): `tailwind.config.js`'s
  `brand.green` was a stale Material-green (`#4CAF50`) nobody actually used
  visually — the whole UI already painted `#1fbf8f` (the `--accent` CSS var)
  via ad-hoc emerald/hardcoded-hex usage. Changed the token to match reality
  (one-line, low-risk fix touching all `bg-brand-green`/`text-brand-green`
  usages at once) instead of the reverse — a much larger, riskier mass find/replace
  across ~50 emerald-class call sites that appeared no more "correct" than the
  token itself. Also fixed the one hardcoded `#4CAF50` in the Dashboard's
  savings chart. The full `<Card>` variant unification from 5.2 is still open.
- **Deferred, on purpose:** splitting `backend/api/system.py` (2,291 lines,
  ~35 routes) into focused routers. Traced enough of the file to find dense,
  cross-cutting shared state (three separate TTL-cached module-level dicts with
  locks, several redact/serialization helpers used by many unrelated route
  groups) that a rushed split risks a dropped route or duplicated cache state —
  and most of these routes need live Plex/NAS/SABnzbd to exercise, which this
  session's isolated preview DB can't provide. `tests/api/test_openapi_contracts.py`
  already checks route paths exist regardless of file layout, so that's a decent
  safety net whenever this is picked up properly. Suggested approach if/when
  resumed: convert to a `backend/api/system/` package, move every module-level
  cache/helper into one `_shared.py` first (removes most of the categorization
  risk), *then* split routes into `health.py`/`storage.py`/`diagnostics.py`/
  `maintenance.py`, composed back into one `/system`-prefixed router in
  `__init__.py` (re-exporting `invalidate_services_health_cache`, which
  `settings.py` imports directly).

A throwaway, fully isolated preview environment now exists for future sessions:
`.claude/launch.json`'s `slimarr-preview` config (port 9495) points at a
scratch config/DB outside the repo (paths in `.claude/dev-preview.bat`), so
future UI verification can register a test account and click through the real
app instead of relying on `tsc`/build success alone. It's disposable — nothing
in it is real user data.

---

## 1. TV episode slimming (the headline feature)

Today TV is delete-only ("stale show cleanup"). 2.0 extends the proven movie
pipeline to episodes:

- Scan Plex TV sections → per-episode size/codec/resolution records (`Episode` model
  mirroring `Movie`).
- Sonarr-aware search (season packs vs single episodes; `tvdbid`/`tvmazeid` Newznab
  params; Prowlarr category 5000-5999).
- Series-level policy: quality intent, "slim whole show to h265", per-season locks.
- Season-pack replacement as a **staged job**: download pack → verify every episode →
  swap one at a time with the existing recovery-record machinery.
- Biggest-wins view: "This show is 800 GB of h264 remux; est. savings 450 GB."

This is the single feature that most changes the value proposition — movie libraries
are typically 2-8 TB, TV libraries 10-40 TB.

## 2. Plan → preview → approve → undo (trust workflow)

- **Tonight's plan**: a dry-run cycle that produces a reviewable queue ("would replace
  X (save 4.2 GB), Y (save 9.1 GB)…") with per-item approve/skip/lock. Builds directly
  on `review_required` + `dry_run`, which already exist but are all-or-nothing.
- **Undo window**: recycle bin + `ReplacementRecoveryRecord` already retain everything
  needed — add a one-click "restore previous file" on Movie Detail / Activity for N days.
- **Replacement diff card**: after a swap, show before/after (size, codec, source,
  bitrate) on the movie page. Data is already in `ActivityLog`.

## 3. Smarter decisions

- Post-download **content verification**: probe duration vs Plex's known runtime
  (±2 min) and decode a sample before replacing; reject when the probe contradicts
  the release title (claims 2160p, file is 720p).
- Uploader/indexer reputation with decay (current counters never age out).
- Move uploader-health lookups off the raw synchronous `sqlite3` connection in
  `comparer.py` (blocks the event loop today; also breaks silently on Postgres —
  it returns 0.5 for every uploader).
- Optional VMAF/SSIM spot-check for "premium/reference" intents (stretch).

## 4. Platform & reliability

- **Alembic migrations** replacing the hand-rolled `_add_column_if_missing` +
  `SCHEMA_VERSION` counter; makes Postgres a first-class citizen.
- Split `backend/api/system.py` (2,291 lines, ~35 routes) into focused routers
  (health, storage, diagnostics, maintenance, nas).
- **Notifications**: Apprise-style webhooks (Discord/Telegram/ntfy/email) for
  replace-completed, cycle summary, recovery-required, and quota-exhausted events.
- Scoped API keys (read-only vs admin) for reverse-proxy/homepage-widget use.
- Structured JSON log option + `/metrics` Prometheus format (partly exists).

## 5. UI 2.0 (visual refresh)

Current UI is already close to the *arr aesthetic; these are the highest-leverage
polish items found in review:

1. **Navigation grouping.** 13 flat sidebar links → 4 groups with children
   (Library {Movies, TV}, Activity {Activity, Queue, Failed, Orphaned},
   System {Overview, Operations, Search Diagnostics, Container}, Settings
   {General, Blacklist}). Failed/Orphaned become **badge counts** on Queue, not
   top-level destinations.
- 2. **Design tokens.** One brand green (Tailwind `brand.green` is `#4CAF50`, but the
   UI paints `#1fbf8f` emerald everywhere) — pick one, define grays/radii/shadows as
   tokens, and swap the four ad-hoc card styles (`bg-gray-900 rounded-xl`,
   `border-white/10 bg-gray-900/70`, gradient hero, `bg-gray-950/40`) for a shared
   `<Card>` with `hero | panel | inset` variants.
3. **One confirm pattern.** `System.tsx` still uses `window.confirm` for preflight
   warnings while the rest of the app has the styled `ConfirmDialog` — migrate it.
4. **Library power tools.** Multi-select bulk actions (lock, intent, search),
   sort by size / potential savings / last replaced, a "Biggest wins" quick filter,
   and grid virtualization for 1,500+ movie libraries (only pagination today).
5. **Live cycle theater.** A slide-over panel during a cycle streaming the decision
   feed (searching X… 3 accepted… grabbed Y) from the socket events that already
   exist (`search:results`, `download:progress`, `replace:completed`).
6. **Savings storytelling.** Dashboard hero stat ("2.1 TB reclaimed since install"),
   per-month bar chart alongside the cumulative area chart, and a codec-mix donut
   (h264 → h265/AV1 progress) — all answerable from existing tables.
7. **Mobile**: bottom tab bar for the 4 nav groups instead of the hamburger-only
   drawer; make System/Settings tables stack.
8. **Accessibility pass**: visible focus rings on all interactive cards (poster cards
   are click-only divs today — make them real links/buttons), contrast bump for
   `text-gray-500`-on-dark metadata, `aria-label`s audit.
9. **Self-hosted font** (see fix #9) and a defined loading skeleton for every page
   (some pages still show nothing while loading).

## 6. Explicitly out of scope for 2.0

- Torrent support (identity of the product is Usenet-first; revisit later).
- Transcoding (Slimarr replaces, it does not encode — keep that boundary).
- Multi-server Plex federation.

---

## Suggested sequencing

| Phase | Content |
|-------|---------|
| 1.8.1 | Fix table above (WAL, exclusions, source_type, toast code, GB formatter, font) |
| 1.9.0 | Plan/preview/approve + undo window + notifications (trust features first — they de-risk 2.0) |
| 2.0.0-beta | TV episode slimming behind a feature flag; nav regroup + design tokens |
| 2.0.0 | TV GA, Alembic, UI 2.0 complete, Postgres first-class |
