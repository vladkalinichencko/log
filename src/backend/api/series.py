import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from ..config import get_storage
from ..domain.read_table import read_jsonl
from ..ports.storage_port import StoragePort

router = APIRouter()


def _epoch_dirs(storage: StoragePort, run_dir: str) -> list[str]:
    return sorted(
        f"{run_dir}/{name}"
        for name in storage.list_dir(run_dir)
        if name.startswith("epoch_") and storage.is_dir(f"{run_dir}/{name}")
    )


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
    run: str, path: str, x: str = "step", storage: StoragePort = Depends(get_storage)
) -> dict:
    project, name = run.split("/", 1)
    run_dir = f"{project}/{name}"
    xs, ys = [], []
    for epoch_dir in _epoch_dirs(storage, run_dir):
        for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl"):
            if path in row.get("scalars", {}):
                xs.append(row.get(x, row["step"]))
                ys.append(row["scalars"][path])
    if not xs:
        raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    xs, ys = _downsample(xs, ys)
    return {"x": xs, "y": ys}


@router.get("/api/series/tensor/steps")
def get_tensor_steps(
    run: str, path: str, storage: StoragePort = Depends(get_storage)
) -> dict:
    project, name = run.split("/", 1)
    run_dir = f"{project}/{name}"
    steps = []
    for epoch_dir in _epoch_dirs(storage, run_dir):
        for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl"):
            if row["path"] == path:
                steps.append(row["step"])
    if not steps:
        raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    return {"steps": sorted(steps)}


@router.get("/api/series/tensor")
def get_tensor_series(
    run: str, path: str, step: int, storage: StoragePort = Depends(get_storage)
) -> dict:
    project, name = run.split("/", 1)
    run_dir = f"{project}/{name}"
    for epoch_dir in _epoch_dirs(storage, run_dir):
        for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl"):
            if row["path"] == path and row["step"] == step:
                arr = storage.read_array(f"{epoch_dir}/tensors/{row['file']}")
                return {
                    "shape": list(arr.shape),
                    "dtype": str(arr.dtype),
                    "data": np.asarray(arr).flatten().tolist(),
                }
    raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
