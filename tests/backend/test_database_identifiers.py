import unittest

from backend.database import _assert_safe_identifier


class SafeIdentifierTests(unittest.TestCase):
    def test_accepts_simple_table_and_column_names(self):
        for name in ["downloads", "search_results", "_internal", "col1", "movie_id"]:
            self.assertEqual(name, _assert_safe_identifier(name))

    def test_rejects_names_with_sql_metacharacters(self):
        for name in [
            "downloads; DROP TABLE movies;--",
            "downloads' OR '1'='1",
            "downloads--",
            "downloads ",
            "down loads",
            "",
            "1downloads",
        ]:
            with self.assertRaises(ValueError):
                _assert_safe_identifier(name)


if __name__ == "__main__":
    unittest.main()
