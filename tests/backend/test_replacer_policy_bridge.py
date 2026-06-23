import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import SlimarrConfig
from backend.core.replacer import (
    _create_replacement_recovery_record,
    _mark_replacement_recovery,
    _run_radarr_post_replace,
)
from backend.database import Base, ReplacementRecoveryRecord


class ReplacerRadarrBridgeTests(unittest.IsolatedAsyncioTestCase):
    def _cfg(self, action: str) -> SlimarrConfig:
        cfg = SlimarrConfig()
        cfg.radarr.enabled = True
        cfg.radarr.url = "http://radarr.local"
        cfg.radarr.api_key = "key"
        cfg.radarr.post_replace_action = action
        return cfg

    async def test_bridge_skips_when_action_none(self) -> None:
        movie = SimpleNamespace(title="The Matrix", imdb_id="tt0133093")
        config = self._cfg("none")

        with patch("backend.integrations.radarr.RadarrClient") as radarr_cls:
            await _run_radarr_post_replace(movie, config)

        radarr_cls.assert_not_called()

    async def test_bridge_dispatches_action_when_enabled(self) -> None:
        movie = SimpleNamespace(title="The Matrix", imdb_id="tt0133093")
        config = self._cfg("rescan_unmonitor")
        radarr_instance = AsyncMock()
        radarr_instance.post_replace_action = AsyncMock(return_value=True)

        with patch("backend.integrations.radarr.RadarrClient", return_value=radarr_instance):
            await _run_radarr_post_replace(movie, config)

        radarr_instance.post_replace_action.assert_awaited_once_with("tt0133093", "rescan_unmonitor")

    async def test_replacement_recovery_record_tracks_phase_and_required_status(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "recovery.sqlite"
            engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", connect_args={"check_same_thread": False})
            maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            try:
                async with maker() as session:
                    movie = SimpleNamespace(id=42, title="The Matrix", quality_intent="space_saver")
                    record = await _create_replacement_recovery_record(
                        session,
                        download_id=7,
                        movie=movie,
                        original_path="Z:/Movies/The Matrix/movie.mkv",
                        mapped_path="Z:/Movies/The Matrix/movie.mkv",
                        target_path="Z:/Movies/The Matrix/movie.mp4",
                        video_file_path="D:/Downloads/movie.mp4",
                        storage_path="D:/Downloads/The Matrix",
                    )
                    await _mark_replacement_recovery(
                        session,
                        record,
                        phase="place_replacement_failed_original_recycled",
                        status="recovery_required",
                        error="File move failed",
                        recycle_path="D:/Recycle/The Matrix_movie.mkv",
                    )

                async with maker() as session:
                    saved = (
                        await session.execute(select(ReplacementRecoveryRecord))
                    ).scalar_one()

                self.assertEqual("recovery_required", saved.status)
                self.assertEqual("place_replacement_failed_original_recycled", saved.phase)
                self.assertEqual("File move failed", saved.error_message)
                self.assertEqual("D:/Recycle/The Matrix_movie.mkv", saved.recycle_path)
                self.assertIsNotNone(saved.completed_at)
            finally:
                await engine.dispose()


if __name__ == "__main__":
    unittest.main()
