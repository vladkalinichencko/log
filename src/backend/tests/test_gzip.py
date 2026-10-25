import json

from fastapi.testclient import TestClient

from backend.main import app


def test_large_tables_travel_gzipped_and_small_answers_stay_plain(tmp_path, monkeypatch):
    run = tmp_path / "p" / "r"
    (run / "epoch_0000").mkdir(parents=True)
    (run / "meta.json").write_text(json.dumps({"status": "finished", "samples_seen": 0}))
    (run / "epoch_0000" / "metrics.jsonl").write_text("\n".join(
        json.dumps({"step": step, "samples_seen": 0, "wall_time": float(step), "rank": 0, "scalars": {"loss": 1 / (step + 1)}})
        for step in range(2000)
    ))
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        large = client.get("/api/table", params={"path": "p.r.epoch_0000.loss"}, headers={"accept-encoding": "gzip"})
        small = client.get("/api/table", params={"path": "missing.run"}, headers={"accept-encoding": "gzip"})
    assert large.headers["content-encoding"] == "gzip"
    assert int(large.headers["content-length"]) < len(large.content) / 5
    assert len(large.json()["cells"]) == 2000
    assert "content-encoding" not in small.headers
