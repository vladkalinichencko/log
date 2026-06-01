import pytest

from backend.api.workspaces import list_workspaces, save_workspace, delete_workspace


def test_save_list_delete(tmp_path):
    ws = {"id": "w1", "tiles": [{"table_path": "p.r.epoch_0000.loss", "representation": "line"}]}
    assert list_workspaces(tmp_path) == []
    save_workspace("w1", ws, tmp_path)
    assert list_workspaces(tmp_path) == [ws]
    delete_workspace("w1", tmp_path)
    assert list_workspaces(tmp_path) == []


def test_delete_missing_raises(tmp_path):
    with pytest.raises(Exception):
        delete_workspace("nope", tmp_path)
