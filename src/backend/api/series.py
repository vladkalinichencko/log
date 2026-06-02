import json
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from ..config import get_runs_root

router = APIRouter()


def _downsample(xs: list, ys: list, target: int = 2000):
    if len(xs) <= target:
        return xs, ys
    buckets = target // 2
    size = len(xs) / buckets
    out_x, out_y = [], []
    for b in range(buckets):
        lo, hi = int(b * size), int((b + 1) * size)
        chunk = ys[lo:hi]
        if not chunk:
            continue
        i_min = lo + chunk.index(min(chunk))
        i_max = lo + chunk.index(max(chunk))
        for i in sorted({i_min, i_max}):
            out_x.append(xs[i])
            out_y.append(ys[i])
    return out_x, out_y


@router.get("/api/series/scalar")
def get_scalar_series(
    run: str, path: str, x: str = "step", runs_root: Path = Depends(get_runs_root)
) -> dict:
    project, name = run.split("/", 1)
    run_dir = runs_root / project / name
    xs, ys = [], []
    for epoch_dir in sorted(run_dir.glob("epoch_*")):
        metrics_path = epoch_dir / "metrics.jsonl"
        if not metrics_path.exists():
            continue
        for line in metrics_path.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                if path in row.get("scalars", {}):
                    xs.append(row.get(x, row["step"]))
                    ys.append(row["scalars"][path])
    if not xs:
        raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    xs, ys = _downsample(xs, ys)
    return {"x": xs, "y": ys}


@router.get("/api/series/tensor")
def get_tensor_series(
    run: str, path: str, step: int, runs_root: Path = Depends(get_runs_root)
) -> dict:
    project, name = run.split("/", 1)
    run_dir = runs_root / project / name
    for epoch_dir in sorted(run_dir.glob("epoch_*")):
        index = epoch_dir / "tensors" / "index.jsonl"
        if not index.exists():
            continue
        for line in index.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                if row["path"] == path and row["step"] == step:
                    arr = np.load(epoch_dir / "tensors" / row["file"], mmap_mode="r")
                    return {
                        "shape": list(arr.shape),
                        "dtype": str(arr.dtype),
                        "data": np.asarray(arr).flatten().tolist(),
                    }
    raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
