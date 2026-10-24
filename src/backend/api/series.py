import numpy as np
from fastapi import APIRouter, Depends

from ..config import get_storage
from ..domain.read_table import epochs, read_jsonl
from ..ports.storage_port import StoragePort
from .errors import ApiError

router = APIRouter()


@router.get("/api/series/scalar")
def get_scalar_series(run: str, path: str, x: str = "step", storage: StoragePort = Depends(get_storage)) -> dict:
    rows = [
        row
        for epoch in epochs(storage, run)
        for row in read_jsonl(storage, f"{run}/{epoch}/metrics.jsonl")
        if path in row["scalars"]
    ]
    if not rows:
        raise ApiError(404, "SERIES_NOT_FOUND", f"no scalar {path!r} in {run}")
    xs, ys = downsample([row.get(x, row["step"]) for row in rows], [row["scalars"][path] for row in rows])
    return {"x": xs, "y": ys}


@router.get("/api/series/tensor/steps")
def get_tensor_steps(run: str, path: str, storage: StoragePort = Depends(get_storage)) -> dict:
    return {"steps": sorted(row["step"] for _, row in _tensor_rows(run, path, storage))}


@router.get("/api/series/tensor")
def get_tensor_series(run: str, path: str, step: int, storage: StoragePort = Depends(get_storage)) -> dict:
    for epoch_dir, row in _tensor_rows(run, path, storage):
        if row["step"] == step:
            array = storage.read_array(f"{epoch_dir}/tensors/{row['file']}")
            return {"shape": list(array.shape), "dtype": str(array.dtype), "data": np.asarray(array).flatten().tolist()}
    raise ApiError(404, "SERIES_NOT_FOUND", f"{path!r} has no step {step} in {run}")


def downsample(xs: list, ys: list, target: int = 2000) -> tuple[list, list]:
    if len(xs) <= target:
        return xs, ys
    buckets = target // 2
    size = len(xs) / buckets
    kept = []
    for bucket in range(buckets):
        low, high = int(bucket * size), int((bucket + 1) * size)
        chunk = ys[low:high]
        kept += sorted({low + chunk.index(min(chunk)), low + chunk.index(max(chunk))})
    return [xs[i] for i in kept], [ys[i] for i in kept]


def _tensor_rows(run: str, path: str, storage: StoragePort) -> list[tuple[str, dict]]:
    rows = [
        (f"{run}/{epoch}", row)
        for epoch in epochs(storage, run)
        for row in read_jsonl(storage, f"{run}/{epoch}/tensors/index.jsonl")
        if row["path"] == path
    ]
    if not rows:
        raise ApiError(404, "SERIES_NOT_FOUND", f"no tensor {path!r} in {run}")
    return rows
