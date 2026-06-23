import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from backend.config import SlimarrConfig, load_config, save_config


class ConfigEnvOverrideTests(unittest.TestCase):
    def test_config_save_replaces_complete_yaml_atomically(self):
        with TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "config.yaml"
            cfg = SlimarrConfig()
            cfg.server.port = 9555

            save_config(cfg, str(target))
            loaded = load_config(str(target))

            self.assertEqual(9555, loaded.server.port)
            self.assertEqual([], list(target.parent.glob(".slimarr-config-*.tmp")))

    def test_default_nas_budgets_are_bounded(self):
        with patch.dict(os.environ, {}, clear=True):
            cfg = load_config("__missing_slimarr_config__.yaml")

        self.assertEqual(150.0, cfg.files.nas_max_write_gb_per_day)
        self.assertEqual(3, cfg.files.nas_max_replacements_per_day)
        self.assertEqual(1, cfg.files.nas_max_concurrent_operations)
        self.assertEqual(50.0, cfg.files.nas_max_transfer_mbps)
        self.assertEqual(8, cfg.files.nas_copy_chunk_mb)
        self.assertFalse(cfg.files.enable_media_probe)

    def test_nas_safety_env_overrides_are_applied(self):
        with patch.dict(
            os.environ,
            {
                "SLIMARR_ENABLE_MEDIA_PROBE": "false",
                "SLIMARR_NAS_PATH_PREFIXES": "Z:/Movies,/mnt/nas-media/movies",
                "SLIMARR_NAS_MAX_WRITE_GB_PER_DAY": "25.5",
                "SLIMARR_NAS_MAX_REPLACEMENTS_PER_DAY": "3",
                "SLIMARR_NAS_MAX_CONCURRENT_OPERATIONS": "1",
                "SLIMARR_NAS_FAILURE_COOLDOWN_MINUTES": "20",
                "SLIMARR_NAS_MAX_TRANSFER_MBPS": "25.5",
                "SLIMARR_NAS_COPY_CHUNK_MB": "4",
                "SLIMARR_MIN_SAVINGS_MB_FOR_NAS": "700",
                "SLIMARR_MIN_CYCLE_INTERVAL_MINUTES": "240",
                "SLIMARR_MAX_DOWNLOADS_PER_NIGHT": "2",
                "SLIMARR_THROTTLE_SECONDS": "90",
                "SLIMARR_MAX_ACTIVE_DOWNLOAD_HOURS": "12",
            },
            clear=True,
        ):
            cfg = load_config("__missing_slimarr_config__.yaml")

        self.assertFalse(cfg.files.enable_media_probe)
        self.assertEqual(["Z:/Movies", "/mnt/nas-media/movies"], cfg.files.nas_path_prefixes)
        self.assertEqual(25.5, cfg.files.nas_max_write_gb_per_day)
        self.assertEqual(3, cfg.files.nas_max_replacements_per_day)
        self.assertEqual(1, cfg.files.nas_max_concurrent_operations)
        self.assertEqual(20, cfg.files.nas_failure_cooldown_minutes)
        self.assertEqual(25.5, cfg.files.nas_max_transfer_mbps)
        self.assertEqual(4, cfg.files.nas_copy_chunk_mb)
        self.assertEqual(700, cfg.comparison.min_savings_mb_for_nas)
        self.assertEqual(240, cfg.schedule.min_cycle_interval_minutes)
        self.assertEqual(2, cfg.schedule.max_downloads_per_night)
        self.assertEqual(90, cfg.schedule.throttle_seconds)
        self.assertEqual(12, cfg.schedule.max_active_download_hours)


if __name__ == "__main__":
    unittest.main()
