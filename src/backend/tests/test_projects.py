import json

from fastapi.testclient import TestClient

from backend.main import app


def test_project_settings_default_then_save_and_read_back_through_the_file(tmp_path, monkeypatch):
    (tmp_path / "p" / "r").mkdir(parents=True)
    (tmp_path / "p" / "r" / "meta.json").write_text(json.dumps({"status": "finished", "samples_seen": 0}))
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        assert client.get("/api/projects/p/settings").json() == {
            "hero": None,
            "alerts": {"non_finite": True, "spike": True, "stall": True, "heartbeat": True},
        }
        saved = client.put("/api/projects/p/settings", json={"hero": "val/loss", "alerts": {"spike": False}})
        assert saved.json()["alerts"] == {"non_finite": True, "spike": False, "stall": True, "heartbeat": True}
        assert client.get("/api/projects/p/settings").json()["hero"] == "val/loss"
        missing = client.get("/api/projects/gone/settings")
    assert json.loads((tmp_path / "p" / "project.json").read_text())["hero"] == "val/loss"
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"
    assert [row[0]["value"] for row in TestClient(app).get("/api/table", params={"path": "p"}).json()["cells"]] == ["r"]
