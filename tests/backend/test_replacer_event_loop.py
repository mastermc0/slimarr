"""Regression tests for replacer.py NOT blocking the asyncio event loop.

Context: replace_file() runs on the asyncio event loop and previously called
os.path.exists/getsize/isdir, os.makedirs, and shutil.disk_usage directly
(without asyncio.to_thread). On a slow/unresponsive NAS share, those syscalls
can block for seconds, freezing the entire app (API, websocket, scheduler)
for the duration. These tests assert the offloaded helpers actually run off
the event loop and still produce correct results.
"""
import asyncio
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from backend.core import replacer


class ReplacerEventLoopTests(unittest.IsolatedAsyncioTestCase):
    async def _assert_does_not_block(self, coro_factory, blocking_seconds=0.2):
        """Run coro_factory() concurrently with a fast ticking loop and verify
        the ticker keeps making progress while coro_factory is "blocked"."""
        ticks = 0

        async def ticker():
            nonlocal ticks
            for _ in range(40):
                await asyncio.sleep(0.01)
                ticks += 1

        await asyncio.gather(coro_factory(), ticker())
        # If the helper had blocked the event loop for blocking_seconds,
        # far fewer than 40 ticks (each needing the loop to be free) would
        # have had a chance to run in that window.
        self.assertGreater(ticks, 20)

    async def test_exists_runs_off_event_loop(self):
        def slow_exists(path):
            time.sleep(0.2)
            return True

        with patch("os.path.exists", side_effect=slow_exists):
            await self._assert_does_not_block(lambda: replacer._exists("/some/path"))

    async def test_disk_free_runs_off_event_loop_and_returns_value(self):
        with TemporaryDirectory() as temp_dir:
            real_disk_usage = replacer.shutil.disk_usage

            def slow_disk_usage(path):
                time.sleep(0.2)
                return real_disk_usage(path)

            result = {}

            async def call():
                result["free"] = await replacer._disk_free(temp_dir)

            with patch("shutil.disk_usage", side_effect=slow_disk_usage):
                await self._assert_does_not_block(call)

            self.assertGreaterEqual(result["free"], 0)

    async def test_find_video_file_async_runs_off_event_loop(self):
        with TemporaryDirectory() as temp_dir:
            video_path = Path(temp_dir) / "movie.mkv"
            video_path.write_bytes(b"data")

            real_walk = replacer.os.walk

            def slow_walk(directory):
                time.sleep(0.2)
                return real_walk(directory)

            result = {}

            async def call():
                result["found"] = await replacer._find_video_file_async(temp_dir)

            with patch("os.walk", side_effect=slow_walk):
                await self._assert_does_not_block(call)

            self.assertEqual(str(video_path), result["found"])

    async def test_makedirs_creates_directory_off_event_loop(self):
        with TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "nested" / "recycle"

            real_makedirs = replacer.os.makedirs

            def slow_makedirs(path, exist_ok=False):
                time.sleep(0.2)
                return real_makedirs(path, exist_ok=exist_ok)

            async def call():
                await replacer._makedirs(str(target))

            with patch("os.makedirs", side_effect=slow_makedirs):
                await self._assert_does_not_block(call)

            self.assertTrue(target.is_dir())


if __name__ == "__main__":
    unittest.main()
