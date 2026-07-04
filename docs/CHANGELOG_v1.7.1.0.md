# Slimarr 1.7.1.0 Release Notes

**Release date:** 2026-07-04
**Theme:** Replacement-Loop Fix and UI Correctness Patches

This is a targeted patch release fixing a bug that caused affected movies to
be endlessly re-searched and re-downloaded, plus a handful of UI correctness
issues found during a pass through user-submitted logs. See `CHANGELOG.md`
for the complete, dated changelog across all releases; this document is the
standalone summary for 1.7.1.0.

## Headline fix: movies stuck in an endless replace loop

Two independent users reported the same symptom: a specific movie
(`The Lord of the Rings: The War of the Rohirrim` in one case, a Disney
Classics `Make Mine Music` file in the other) kept getting re-downloaded and
replaced on every automation cycle, night after night, never settling.

The root cause: `replace_file()` updated a movie's tracked `file_path` and
`file_size` after swapping in a new file, but never updated its `resolution`,
`video_codec`, `audio_codec`, or `bitrate` — those stayed at whatever the
*previous* file's values were, indefinitely. The scanner compounded this: it
only re-probes a file's real media info when the database *doesn't already
have* resolution/codec/bitrate populated, with no way to notice the
underlying file had actually changed. Once a replacement happened, the
movie's recorded quality permanently diverged from what was actually on
disk, which made the local copy look like a low-quality/mismatched candidate
for replacement — so the next cycle "upgraded" it again, and the one after
that, forever.

`replace_file()` now re-probes the file at its final location right after
the move succeeds and persists the real resolution/codec/bitrate onto the
movie record, the same probing logic the scanner already used elsewhere,
just actually saved this time.

(Two related error patterns surfaced while investigating this in the shared
logs — a `downloads` table migration gap and an intermittent indexer
rate-limit storm — but both were already fixed by earlier releases; no
further action was needed there.)

## Dashboard performance

- The System page's NAS storage-pressure panel queries recent
  `decision_audit_log` rows by `decision` + a `created_at` window on every
  refresh. An index already existed on `(created_at, decision)`, but
  `EXPLAIN QUERY PLAN` against a real database showed SQLite's planner
  ignoring it for this query shape in favor of a single-column index,
  filtering the date range row-by-row across the entire reject history.
  Live logs showed this taking up to 6.4 seconds. Added a
  `(decision, created_at)` leading composite index; a synthetic benchmark
  at comparable row counts went from ~23ms to ~2.6ms.

## UI fixes

- **Movie Detail:** navigating to a different movie within a few seconds of
  triggering a search/process/download no longer risks the previous movie's
  stale response overwriting the new movie's on-screen data. React Router
  reuses this component across navigations, so a pending `setTimeout` from
  the old movie could still fire and apply its result to whichever movie
  happened to be showing.
- **Library:** fast typing in the search box no longer risks showing results
  for an earlier, superseded query if its response happens to arrive after a
  more recent one's.
- **System page:** the "Run Now" button no longer gets stuck showing
  "Starting…" forever if starting the automation cycle fails outright —
  it previously only cleared that state via a socket event that may never
  arrive on a failed start.

## Verification

- Backend: full `pytest tests/backend` suite (89 tests) passes.
- Frontend: `tsc --noEmit` and a production `vite build` both pass cleanly
  with zero errors.
