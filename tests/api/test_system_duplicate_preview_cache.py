import unittest
from unittest.mock import AsyncMock, patch

from backend.api import system


class DuplicatePreviewCacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        system._duplicate_preview_cache = None
        system._duplicate_preview_cache_at = 0.0

    async def test_larger_cached_preview_satisfies_smaller_maintenance_read(self):
        payload = {
            "status": "ok",
            "movies_scanned": 500,
            "duplicates_found": 1,
            "estimated_reclaimable_bytes": 100,
            "confidence": {"high": 1, "medium": 0, "low": 0},
            "sample": [],
            "truncated": False,
        }

        with patch(
            "backend.core.cleanup.preview_duplicate_cleanup",
            AsyncMock(return_value=payload),
        ) as preview:
            first = await system._duplicate_preview_cached(max_movies_per_section=500)
            second = await system._duplicate_preview_cached(max_movies_per_section=250, allow_scan=False)

        self.assertEqual(payload, first)
        self.assertEqual(payload, second)
        preview.assert_awaited_once()

    async def test_uncached_maintenance_read_does_not_scan(self):
        with patch(
            "backend.core.cleanup.preview_duplicate_cleanup",
            AsyncMock(),
        ) as preview:
            result = await system._duplicate_preview_cached(max_movies_per_section=250, allow_scan=False)

        self.assertEqual("not_cached", result["status"])
        preview.assert_not_awaited()


class RecycleStatsCacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        system._recycle_stats_cache = None
        system._recycle_stats_cache_at = 0.0

    async def test_repeated_health_reads_reuse_directory_snapshot(self):
        with patch("backend.api.system._dir_stats", return_value=(4, 1024)) as scan:
            first = await system._dir_stats_cached("Z:/recycle")
            second = await system._dir_stats_cached("Z:/recycle")

        self.assertEqual((4, 1024), first)
        self.assertEqual(first, second)
        scan.assert_called_once_with("Z:/recycle")


if __name__ == "__main__":
    unittest.main()
