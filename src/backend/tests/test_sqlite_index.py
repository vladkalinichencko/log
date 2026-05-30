from backend.adapters.sqlite_index import SqliteIndex


def test_sqlite_index_exists():
    assert SqliteIndex() is not None
