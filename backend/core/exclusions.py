"""Movie exclusion rules — keep specific library items out of search/automation
entirely (as opposed to force_keep/slimarr_locked, which are per-movie policy
set from the UI). Configured under `exclusions:` in config.yaml.

Checked once per movie before a search is issued, so an excluded movie's title
is never sent to an indexer — this matters for personal footage (home videos,
wedding films) living in the same Plex library as commercial media.
"""
from __future__ import annotations

from datetime import datetime, timezone

from backend.core.storage import path_matches_prefix


def is_movie_excluded(movie, config) -> tuple[bool, str | None]:
    """Return (excluded, reason) for a Movie against config.exclusions.

    All checks are opt-in: an empty/zero rule never excludes anything.
    """
    rules = getattr(config, "exclusions", None)
    if rules is None:
        return False, None

    if rules.movie_ids and movie.id in rules.movie_ids:
        return True, "excluded_movie_id"

    if rules.title_keywords:
        title = (movie.title or "").lower()
        for keyword in rules.title_keywords:
            keyword = str(keyword or "").strip().lower()
            if keyword and keyword in title:
                return True, f"excluded_title_keyword:{keyword}"

    if rules.folders and path_matches_prefix(movie.file_path, rules.folders):
        return True, "excluded_folder"

    if rules.codecs:
        codec = (movie.video_codec or "").lower()
        excluded_codecs = {str(c or "").strip().lower() for c in rules.codecs}
        if codec and codec in excluded_codecs:
            return True, f"excluded_codec:{codec}"

    if rules.resolutions:
        resolution = (movie.resolution or "").lower()
        excluded_resolutions = {str(r or "").strip().lower() for r in rules.resolutions}
        if resolution and resolution in excluded_resolutions:
            return True, f"excluded_resolution:{resolution}"

    min_size_bytes = max(0, int(rules.minimum_file_size_mb or 0)) * 1_048_576
    if min_size_bytes > 0 and (movie.file_size or 0) < min_size_bytes:
        return True, "below_minimum_file_size"

    max_age_days = max(0, int(rules.maximum_age_days or 0))
    if max_age_days > 0 and movie.added_at is not None:
        added_at = movie.added_at
        if added_at.tzinfo is None:
            added_at = added_at.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - added_at).total_seconds() / 86400
        if age_days > max_age_days:
            return True, "exceeds_maximum_age_days"

    return False, None
