import json

import numpy as np
from fastapi.testclient import TestClient

from backend.api.series import downsample
from backend.main import app


def _series_run(root):
    tensors = root / "p" / "r" / "epoch_0000" / "tensors"
    tensors.mkdir(parents=True)
    rows = [{"step": i, "samples_seen": 0, "wall_time": 1.0, "rank": 0, "scalars": {"loss": 1.0 / (i + 1)}} for i in range(5)]
    (root / "p" / "r" / "epoch_0000" / "metrics.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
    np.save(tensors / "w__step000000000.npy", np.arange(6).reshape(2, 3))
    (tensors / "index.jsonl").write_text(
        json.dumps({"path": "w", "step": 0, "file": "w__step000000000.npy", "shape": [2, 3], "dtype": "int64"})
    )


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    _series_run(tmp_path)
    return TestClient(app)


def test_scalar_series_route(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        series = client.get("/api/series/scalar", params={"run": "p/r", "path": "loss"}).json()
    assert series["x"] == [0, 1, 2, 3, 4]
    assert series["y"][0] == 1.0


def test_downsample_caps_points_and_keeps_extremes():
    xs = list(range(5000))
    ys = [float(v) for v in xs]
    kept_x, kept_y = downsample(xs, ys, 2000)
    assert len(kept_x) <= 2000
    assert min(ys) in kept_y and max(ys) in kept_y


def test_tensor_frame_route(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        frame = client.get("/api/series/tensor", params={"run": "p/r", "path": "w", "step": 0}).json()
    assert frame["shape"] == [2, 3]
    assert frame["data"] == [0, 1, 2, 3, 4, 5]


def test_tensor_steps_route(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        assert client.get("/api/series/tensor/steps", params={"run": "p/r", "path": "w"}).json() == {"steps": [0]}


def test_missing_tensor_returns_structured_error(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        response = client.get("/api/series/tensor/steps", params={"run": "p/r", "path": "missing"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SERIES_NOT_FOUND"
