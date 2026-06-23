import unittest

from backend.integrations.plex import PlexClient


class _Section:
    def __init__(self, title: str, section_type: str = "movie"):
        self.title = title
        self.type = section_type
        self.updated = 0

    def update(self):
        self.updated += 1


class _Library:
    def __init__(self):
        self.movie_a = _Section("Movies")
        self.movie_b = _Section("Kids Movies")
        self.shows = _Section("TV", "show")
        self.by_name = {
            self.movie_a.title: self.movie_a,
            self.movie_b.title: self.movie_b,
            self.shows.title: self.shows,
        }

    def sections(self):
        return list(self.by_name.values())

    def section(self, name: str):
        return self.by_name[name]


class _Server:
    def __init__(self):
        self.library = _Library()


class PlexRefreshTests(unittest.TestCase):
    def test_refresh_library_refreshes_all_movie_sections_when_unconfigured(self):
        server = _Server()
        client = PlexClient()
        client.library_sections = []
        client._server = server

        client.refresh_library()

        self.assertEqual(1, server.library.movie_a.updated)
        self.assertEqual(1, server.library.movie_b.updated)
        self.assertEqual(0, server.library.shows.updated)

    def test_refresh_library_uses_configured_sections_when_present(self):
        server = _Server()
        client = PlexClient()
        client.library_sections = ["Kids Movies"]
        client._server = server

        client.refresh_library()

        self.assertEqual(0, server.library.movie_a.updated)
        self.assertEqual(1, server.library.movie_b.updated)


if __name__ == "__main__":
    unittest.main()
