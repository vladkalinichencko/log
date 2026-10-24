from fastapi.testclient import TestClient

from backend.main import app


def test_workspace_save_list_delete_through_routes(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    workspace = {"id": "w1", "tiles": [{"table_path": "p.r.epoch_0000.loss", "representation": "line"}]}
    with TestClient(app) as client:
        assert client.get("/api/workspaces").json() == []
        client.put("/api/workspaces/w1", json=workspace)
        assert client.get("/api/workspaces").json() == [workspace]
        client.delete("/api/workspaces/w1")
        assert client.get("/api/workspaces").json() == []


def test_delete_missing_workspace_returns_structured_error(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        response = client.delete("/api/workspaces/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WORKSPACE_NOT_FOUND"
