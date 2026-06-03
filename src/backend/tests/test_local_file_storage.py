import numpy as np

from backend.adapters.local_file_storage import LocalFileStorage


def test_read_returns_file_bytes(tmp_path):
    (tmp_path / "a.txt").write_bytes(b"hello")
    storage = LocalFileStorage(tmp_path)
    assert storage.read("a.txt") == b"hello"


def test_read_array_memory_maps_npy(tmp_path):
    np.save(tmp_path / "t.npy", np.arange(6).reshape(2, 3))
    storage = LocalFileStorage(tmp_path)
    arr = storage.read_array("t.npy")
    assert arr.shape == (2, 3)
    assert arr[1, 2] == 5


def test_is_dir_and_exists(tmp_path):
    (tmp_path / "d").mkdir()
    (tmp_path / "f.txt").write_text("x")
    storage = LocalFileStorage(tmp_path)
    assert storage.is_dir("d") and not storage.is_dir("f.txt")
    assert storage.exists("f.txt") and not storage.exists("nope")


def test_list_dir_names_entries(tmp_path):
    (tmp_path / "one").mkdir()
    (tmp_path / "two.txt").write_text("x")
    storage = LocalFileStorage(tmp_path)
    assert sorted(storage.list_dir(".")) == ["one", "two.txt"]


def test_list_dir_missing_is_empty(tmp_path):
    storage = LocalFileStorage(tmp_path)
    assert storage.list_dir("nope") == []
