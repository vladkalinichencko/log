from backend.adapters.sqlite_index import SqliteIndex

# Stage 0: the derived SQLite index is stubbed (§3.1, §14, ADR-003). This pins
# that the adapter exists and is importable; query/upsert/rebuild behavior is
# tested when the index lands.


def test_sqlite_index_exists():
    assert SqliteIndex() is not None
