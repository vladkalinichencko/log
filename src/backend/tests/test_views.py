import pytest
from fastapi import HTTPException

from backend.api.views import delete_view, list_views, save_view


def test_view_save_list_delete(tmp_path):
    view = {"id": "p.r.epoch_0000.loss", "table": {"name": "loss"}}
    assert list_views(tmp_path) == []
    save_view("v1", view, tmp_path)
    assert list_views(tmp_path) == [view]
    delete_view("v1", tmp_path)
    assert list_views(tmp_path) == []


def test_delete_view_missing_raises(tmp_path):
    with pytest.raises(HTTPException):
        delete_view("nope", tmp_path)
