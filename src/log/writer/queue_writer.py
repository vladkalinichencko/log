import json
import os
import queue
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch

from .atomic import append_jsonl, atomic_write_bytes, read_jsonl, update_json
from .tensor_io import write_npy


@dataclass
class WriteJob:

    pass


@dataclass
class ScalarJob(WriteJob):
    path: str
    value: float | int | bool
    step: int
    samples_seen: int
    wall_time: float
    rank: int
    epoch: int


@dataclass
class TensorJob(WriteJob):
    path: str
    tensor: torch.Tensor
    step: int
    samples_seen: int
    wall_time: float
    rank: int
    epoch: int


@dataclass
class CheckpointJob(WriteJob):
    payload: dict
    tag: str
    epoch: int
    metric: str | None
    mode: str
    keep_top_k: int


@dataclass
class MetaJob(WriteJob):
    fields: dict


@dataclass
class AlertJob(WriteJob):
    row: dict
    epoch: int


class WriterThread:

    def __init__(self, run_dir: Path, meta_path: Path):
        self.run_dir = run_dir
        self.meta_path = meta_path
        self.queue: queue.Queue = queue.Queue()
        self.thread: threading.Thread | None = None
        self.current_step_scalars: dict[tuple[int, int, int], dict[str, Any]] = {}

    def start(self) -> None:
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop_and_join(self) -> None:
        self.queue.put(None)
        if self.thread is not None:
            self.thread.join()

    def enqueue(self, job: WriteJob) -> None:
        self.queue.put(job)

    def _run(self) -> None:
        while True:
            job = self.queue.get()
            if job is None:
                self._flush_scalars()
                break
            try:
                self._process(job)
            except Exception as e:
                self._append_error(str(e))

    def _process(self, job: WriteJob) -> None:
        if isinstance(job, ScalarJob):
            key = (job.epoch, job.step, job.rank)
            if key not in self.current_step_scalars:
                self.current_step_scalars[key] = {
                    "step": job.step,
                    "samples_seen": job.samples_seen,
                    "wall_time": job.wall_time,
                    "rank": job.rank,
                    "scalars": {},
                }
            self.current_step_scalars[key]["scalars"][job.path] = job.value

            seen = sorted(set((k[0], k[1]) for k in self.current_step_scalars))
            if len(seen) > 1:
                for epoch, step in seen[:-1]:
                    self._flush_step(epoch, step)

        elif isinstance(job, TensorJob):
            self._write_tensor(job)

        elif isinstance(job, CheckpointJob):
            self._write_checkpoint(job)

        elif isinstance(job, MetaJob):
            update_json(self.meta_path, job.fields)

        elif isinstance(job, AlertJob):
            append_jsonl(self.run_dir / f"epoch_{job.epoch:04d}" / "alerts.jsonl", job.row)

    def _flush_scalars(self) -> None:
        for epoch, step in sorted(set((k[0], k[1]) for k in self.current_step_scalars)):
            self._flush_step(epoch, step)

    def _flush_step(self, epoch: int, step: int) -> None:
        keys = [k for k in self.current_step_scalars if k[0] == epoch and k[1] == step]
        for key in keys:
            row = self.current_step_scalars.pop(key)
            append_jsonl(self.run_dir / f"epoch_{epoch:04d}" / "metrics.jsonl", row)

    def _write_tensor(self, job: TensorJob) -> None:
        tensors_dir = self.run_dir / f"epoch_{job.epoch:04d}" / "tensors"
        arr = job.tensor.detach().cpu().numpy()
        safe_name = "".join(c if c not in r'/\:*?"<>|' else "_" for c in job.path)
        filename = f"{safe_name}__step{job.step:09d}.npy"
        write_npy(tensors_dir / filename, arr)
        append_jsonl(tensors_dir / "index.jsonl", {
            "path": job.path,
            "step": job.step,
            "samples_seen": job.samples_seen,
            "wall_time": job.wall_time,
            "rank": job.rank,
            "file": filename,
            "shape": list(arr.shape),
            "dtype": str(arr.dtype),
        })

    def _write_checkpoint(self, job: CheckpointJob) -> None:
        ckpt_dir = self.run_dir / "checkpoints"
        ckpt_dir.mkdir(parents=True, exist_ok=True)
        tmp = ckpt_dir / f"{job.tag}.pt.tmp"
        torch.save(job.payload, tmp)
        os.replace(tmp, ckpt_dir / f"{job.tag}.pt")

        index_path = ckpt_dir / "index.jsonl"
        rows = [r for r in read_jsonl(index_path) if r["tag"] != job.tag]
        rows.append({"tag": job.tag, "step": job.payload["step"], "metric": self._latest_metric(job)})

        keep = rotation_keep(rows, job.metric, job.mode, job.keep_top_k)
        for r in rows:
            if r["tag"] not in keep:
                (ckpt_dir / f"{r['tag']}.pt").unlink(missing_ok=True)
        rows = [{**r, "is_top_k": True} for r in rows if r["tag"] in keep]
        atomic_write_bytes(index_path, ("\n".join(json.dumps(r) for r in rows) + "\n").encode())

    def _latest_metric(self, job: CheckpointJob) -> float | None:
        if job.metric is None:
            return None
        rows = read_jsonl(self.run_dir / f"epoch_{job.epoch:04d}" / "metrics.jsonl")
        values = [row["scalars"][job.metric] for row in rows if job.metric in row.get("scalars", {})]
        return values[-1] if values else None

    def _append_error(self, error: str) -> None:
        errors = json.loads(self.meta_path.read_text()).get("writer_errors", [])
        update_json(self.meta_path, {"writer_errors": [*errors, error]})


def rotation_keep(rows: list[dict], metric: str | None, mode: str, k: int) -> set:
    latest = max(rows, key=lambda r: r["step"])["tag"]
    if metric is None:
        best = sorted(rows, key=lambda r: r["step"], reverse=True)[:k]
        return {r["tag"] for r in best} | {latest}
    worst = float("inf") if mode == "min" else float("-inf")
    ordered = sorted(
        rows,
        key=lambda r: r["metric"] if r["metric"] is not None else worst,
        reverse=(mode == "max"),
    )
    return {r["tag"] for r in ordered[:k]} | {latest}
