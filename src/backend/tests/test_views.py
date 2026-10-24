from fastapi.testclient import TestClient

from backend.main import app


def test_view_save_list_delete_through_routes(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    view = {"id": "p.r.epoch_0000.loss", "name": "loss"}
    with TestClient(app) as client:
        assert client.get("/api/views").json() == []
        assert client.put("/api/views/v1", json=view).json() == view
        assert client.get("/api/views").json() == [view]
        assert client.delete("/api/views/v1").json() == {"deleted": True}
        assert client.get("/api/views").json() == []


def test_delete_missing_view_returns_structured_error(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        response = client.delete("/api/views/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "VIEW_NOT_FOUND"
