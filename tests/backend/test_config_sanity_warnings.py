import unittest
from types import SimpleNamespace

import backend.core.startup as startup


class ConfigSanityWarningsTests(unittest.TestCase):
    def setUp(self):
        startup._startup_warnings = []

    def _cfg(self, allowed_origins=None, nas_path_prefixes=None):
        return SimpleNamespace(
            server=SimpleNamespace(allowed_origins=allowed_origins or ["http://localhost:9494"]),
            files=SimpleNamespace(nas_path_prefixes=nas_path_prefixes or [], recycling_bin=""),
            schedule=SimpleNamespace(max_downloads_per_night=10, throttle_seconds=30),
            comparison=SimpleNamespace(min_savings_mb_for_nas=0),
        )

    def test_wildcard_cors_origin_warns(self):
        startup._check_config_sanity(self._cfg(allowed_origins=["*"]))
        warnings = startup.get_startup_warnings()
        self.assertTrue(any("allowed_origins" in w for w in warnings))

    def test_explicit_origins_do_not_warn(self):
        startup._check_config_sanity(self._cfg(allowed_origins=["http://localhost:9494"]))
        warnings = startup.get_startup_warnings()
        self.assertFalse(any("allowed_origins" in w for w in warnings))

    def test_wildcard_warning_fires_even_without_nas_paths(self):
        startup._check_config_sanity(self._cfg(allowed_origins=["*"], nas_path_prefixes=[]))
        warnings = startup.get_startup_warnings()
        self.assertTrue(any("allowed_origins" in w for w in warnings))


if __name__ == "__main__":
    unittest.main()
