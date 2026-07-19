import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from backend.config import SlimarrConfig
from backend.core.exclusions import is_movie_excluded


def _movie(**overrides):
    base = dict(
        id=1,
        title="Some Movie",
        file_path="/data/movies/Some Movie/Some.Movie.mkv",
        video_codec="h264",
        resolution="1080p",
        file_size=2_000_000_000,
        added_at=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class ExclusionRuleTests(unittest.TestCase):
    def test_no_rules_never_excludes(self) -> None:
        cfg = SlimarrConfig()
        excluded, reason = is_movie_excluded(_movie(), cfg)
        self.assertFalse(excluded)
        self.assertIsNone(reason)

    def test_movie_id_exclusion(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.movie_ids = [1, 2, 3]
        excluded, reason = is_movie_excluded(_movie(id=2), cfg)
        self.assertTrue(excluded)
        self.assertEqual(reason, "excluded_movie_id")

    def test_title_keyword_is_case_insensitive_substring(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.title_keywords = ["wedding"]
        excluded, reason = is_movie_excluded(_movie(title="Caitlyn & Matt's Wedding Film"), cfg)
        self.assertTrue(excluded)
        self.assertIn("wedding", reason or "")

    def test_folder_prefix_exclusion(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.folders = ["/data/home-videos"]
        excluded, _ = is_movie_excluded(
            _movie(file_path="/data/home-videos/2018/wedding.mkv"), cfg
        )
        self.assertTrue(excluded)

        not_excluded, _ = is_movie_excluded(
            _movie(file_path="/data/movies/Some Movie/Some.Movie.mkv"), cfg
        )
        self.assertFalse(not_excluded)

    def test_codec_exclusion(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.codecs = ["av1"]
        excluded, _ = is_movie_excluded(_movie(video_codec="av1"), cfg)
        self.assertTrue(excluded)

    def test_resolution_exclusion(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.resolutions = ["480p"]
        excluded, _ = is_movie_excluded(_movie(resolution="480p"), cfg)
        self.assertTrue(excluded)

    def test_minimum_file_size_excludes_tiny_files(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.minimum_file_size_mb = 500
        excluded, reason = is_movie_excluded(_movie(file_size=100_000_000), cfg)
        self.assertTrue(excluded)
        self.assertEqual(reason, "below_minimum_file_size")

        not_excluded, _ = is_movie_excluded(_movie(file_size=1_000_000_000), cfg)
        self.assertFalse(not_excluded)

    def test_maximum_age_days_excludes_old_library_entries(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.maximum_age_days = 30
        old_movie = _movie(added_at=datetime.now(timezone.utc) - timedelta(days=90))
        excluded, reason = is_movie_excluded(old_movie, cfg)
        self.assertTrue(excluded)
        self.assertEqual(reason, "exceeds_maximum_age_days")

        recent_movie = _movie(added_at=datetime.now(timezone.utc) - timedelta(days=1))
        not_excluded, _ = is_movie_excluded(recent_movie, cfg)
        self.assertFalse(not_excluded)

    def test_maximum_age_days_ignored_when_added_at_missing(self) -> None:
        cfg = SlimarrConfig()
        cfg.exclusions.maximum_age_days = 30
        excluded, _ = is_movie_excluded(_movie(added_at=None), cfg)
        self.assertFalse(excluded)


if __name__ == "__main__":
    unittest.main()
