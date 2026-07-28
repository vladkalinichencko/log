import json

from fastapi.testclient import TestClient

from backend.adapters.local_file_storage import LocalFileStorage
from backend.domain.compare_runs import compare_runs
from backend.main import app


def _run(root, name, lr, losses, tensor=False):
    run = root / "p" / name
    tensors = run / "epoch_0000" / "tensors"
    tensors.mkdir(parents=True)
    (run / "config.json").write_text(json.dumps({"params": {"lr": lr, "batch": 32}}))
    (run / "meta.json").write_text(json.dumps({"status": "finished", "samples_seen": 2}))
    rows = [
        {"step": step, "rank": 0, "scalars": {"loss": loss}}
        for step, loss in enumerate(losses)
    ]
    (run / "epoch_0000" / "metrics.jsonl").write_text(
        "\n".join(json.dumps(row) for row in rows)
    )
    if tensor:
        (tensors / "index.jsonl").write_text(json.dumps({
            "path": "weights", "step": 1, "rank": 0,
            "shape": [2, 3], "dtype": "float32", "file": "weights.npy",
        }))


def test_compare_runs_aligns_config_metrics_and_tensor_metadata(tmp_path):
    _run(tmp_path, "a", 0.1, [2.0, 1.0], tensor=True)
    _run(tmp_path, "b", 0.2, [3.0])
    table = compare_runs(["p.a", "p.b"], LocalFileStorage(tmp_path))
    rows = {tuple(cell.value for cell in row[:2]): [cell.value for cell in row[2:]] for row in table.cells}
    assert table.column_names == ["section", "key", "p.a", "p.b"]
    assert rows[("config", "lr")] == ["0.1", "0.2"]
    assert rows[("metrics", "epoch_0000.loss · step 1 · rank 0")] == ["1.0", ""]
    assert rows[("tensors", "epoch_0000.weights · step 1 · rank 0")] == ["[2, 3] float32", ""]


def test_compare_runs_route(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    _run(tmp_path, "a", 0.1, [2.0])
    _run(tmp_path, "b", 0.2, [3.0])
    with TestClient(app) as client:
        response = client.post("/api/runs/compare", json={"runs": ["p.a", "p.b"]})
    assert response.status_code == 200
    assert response.json()["name"] == "run comparison"
