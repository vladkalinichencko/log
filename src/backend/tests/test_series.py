import json

import numpy as np
import pytest
from fastapi import HTTPException

from backend.api.series import _downsample, get_scalar_series, get_tensor_series


def _series_run(root):
    epoch = root / "p" / "r" / "epoch_0000"
    (epoch / "tensors").mkdir(parents=True)
    rows = [
        {"step": i, "samples_seen": 0, "wall_time": 1.0, "rank": 0, "scalars": {"loss": 1.0 / (i + 1)}}
        for i in range(5)
    ]
    (epoch / "metrics.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
    np.save(epoch / "tensors" / "w__step000000000.npy", np.arange(6).reshape(2, 3))
    (epoch / "tensors" / "index.jsonl").write_text(
        json.dumps({"path": "w", "step": 0, "file": "w__step000000000.npy", "shape": [2, 3], "dtype": "int64"})
    )


def test_scalar_series(tmp_path):
    _series_run(tmp_path)
    out = get_scalar_series("p/r", "loss", "step", tmp_path)
    assert out["x"] == [0, 1, 2, 3, 4]
    assert out["y"][0] == 1.0


def test_scalar_series_missing_404(tmp_path):
    _series_run(tmp_path)
    with pytest.raises(HTTPException):
        get_scalar_series("p/r", "nope", "step", tmp_path)


def test_tensor_series(tmp_path):
    _series_run(tmp_path)
    out = get_tensor_series("p/r", "w", 0, tmp_path)
    assert out["shape"] == [2, 3]
    assert out["data"] == [0, 1, 2, 3, 4, 5]


def test_downsample_caps_and_keeps_extremes():
    xs = list(range(5000))
    ys = [float(v) for v in xs]
    dx, dy = _downsample(xs, ys, 2000)
    assert len(dx) <= 2000
    assert min(ys) in dy and max(ys) in dy
