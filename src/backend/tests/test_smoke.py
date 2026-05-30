"""End-to-end smoke test (§14 Stage 0): run a tiny decorated script, then verify
the files the writer produced. `pythonpath=src` (pyproject) makes `import log` work.
"""
import json
import tempfile
from pathlib import Path

import log


def test_smoke():
    with tempfile.TemporaryDirectory() as tmpdir:
        runs_root = Path(tmpdir) / "runs"

        @log.run(project="test_project", config={"lr": 0.001}, runs_root=str(runs_root))
        def train():
            log.log("loss", 2.5, step=1)
            log.log("accuracy", 0.9, step=1)

        train()

        project_dir = runs_root / "test_project"
        run_dirs = list(project_dir.iterdir())
        assert len(run_dirs) == 1
        run_dir = run_dirs[0]

        assert (run_dir / "config.json").exists()

        meta = json.loads((run_dir / "meta.json").read_text())
        assert meta["status"] == "finished"

        metrics_path = run_dir / "epoch_0000" / "metrics.jsonl"
        lines = metrics_path.read_text().splitlines()
        assert len(lines) == 1
        row = json.loads(lines[0])
        assert row["step"] == 1
        assert row["scalars"]["loss"] == 2.5
        assert row["scalars"]["accuracy"] == 0.9
