from backend.adapters.local_file_storage import LocalFileStorage


def test_read_returns_file_bytes(tmp_path):
    (tmp_path / "a.txt").write_bytes(b"hello")
    storage = LocalFileStorage(tmp_path)
    assert storage.read("a.txt") == b"hello"


def test_list_dir_names_entries(tmp_path):
    (tmp_path / "one").mkdir()
    (tmp_path / "two.txt").write_text("x")
    storage = LocalFileStorage(tmp_path)
    assert sorted(storage.list_dir(".")) == ["one", "two.txt"]


def test_list_dir_missing_is_empty(tmp_path):
    storage = LocalFileStorage(tmp_path)
    assert storage.list_dir("nope") == []
