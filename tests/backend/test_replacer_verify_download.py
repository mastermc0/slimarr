"""Tests for files.verify_after_download, which was previously a documented no-op."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from backend.core.replacer import _verify_downloaded_file


class VerifyDownloadedFileTests(unittest.IsolatedAsyncioTestCase):
    def _config(self, enable_media_probe: bool = False):
        return SimpleNamespace(files=SimpleNamespace(enable_media_probe=enable_media_probe))

    async def test_rejects_empty_file(self):
        with TemporaryDirectory() as temp_dir:
            empty_file = Path(temp_dir) / "movie.mkv"
            empty_file.write_bytes(b"")

            error = await _verify_downloaded_file(str(empty_file), self._config())

            self.assertIsNotNone(error)
            self.assertIn("empty", error)

    async def test_accepts_non_empty_file_without_probe(self):
        with TemporaryDirectory() as temp_dir:
            video_file = Path(temp_dir) / "movie.mkv"
            video_file.write_bytes(b"not a real video but non-empty")

            error = await _verify_downloaded_file(str(video_file), self._config(enable_media_probe=False))

            self.assertIsNone(error)

    async def test_does_not_hard_fail_when_probe_finds_nothing(self):
        with TemporaryDirectory() as temp_dir:
            video_file = Path(temp_dir) / "movie.mkv"
            video_file.write_bytes(b"not a real video but non-empty")

            # pymediainfo will return {} for a file that isn't a real container;
            # verification should warn, not block replacement.
            error = await _verify_downloaded_file(str(video_file), self._config(enable_media_probe=True))

            self.assertIsNone(error)


if __name__ == "__main__":
    unittest.main()
