import json
import queue
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch

from .atomic import append_jsonl, atomic_write_bytes
from .tensor_io import write_npy


@dataclass
class WriteJob:
    """Base class for write jobs."""

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
    run_dir: Path


class WriterThread:
    """Background writer thread consuming WriteJobs from a queue."""

    def __init__(self, run_dir: Path, meta_path: Path):
        self.run_dir = run_dir
        self.meta_path = meta_path
        self.queue: queue.Queue = queue.Queue()
        self.thread: threading.Thread | None = None
        self.current_step_scalars: dict[tuple[int, int], dict[str, Any]] = {}

    def start(self) -> None:
        """Start the background writer thread."""
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop_and_join(self) -> None:
        """Enqueue sentinel and join the thread."""
        self.queue.put(None)
        if self.thread is not None:
            self.thread.join()

    def enqueue(self, job: WriteJob) -> None:
        """Enqueue a write job."""
        self.queue.put(job)

    def _run(self) -> None:
        """Worker loop: drain queue until sentinel None."""
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
        """Process one write job."""
        if isinstance(job, ScalarJob):
            key = (job.step, job.rank)
            if key not in self.current_step_scalars:
                self.current_step_scalars[key] = {
                    "step": job.step,
                    "samples_seen": job.samples_seen,
                    "wall_time": job.wall_time,
                    "rank": job.rank,
                    "scalars": {},
                }
            self.current_step_scalars[key]["scalars"][job.path] = job.value

            # Flush if step advanced
            all_steps = sorted(set(k[0] for k in self.current_step_scalars.keys()))
            if len(all_steps) > 1:
                for s in all_steps[:-1]:
                    self._flush_step(s)

        elif isinstance(job, TensorJob):
            self._write_tensor(job)

        elif isinstance(job, CheckpointJob):
            self._write_checkpoint(job)

    def _flush_scalars(self) -> None:
        """Flush all pending scalar rows."""
        for step in sorted(set(k[0] for k in self.current_step_scalars.keys())):
            self._flush_step(step)

    def _flush_step(self, step: int) -> None:
        """Flush all rows for a given step."""
        keys = [k for k in self.current_step_scalars.keys() if k[0] == step]
        for key in keys:
            row = self.current_step_scalars.pop(key)
            epoch = 0  # v0: single epoch
            epoch_dir = self.run_dir / f"epoch_{epoch:04d}"
            metrics_path = epoch_dir / "metrics.jsonl"
            append_jsonl(metrics_path, row)

    def _write_tensor(self, job: TensorJob) -> None:
        """Write one tensor job."""
        epoch_dir = self.run_dir / f"epoch_{job.epoch:04d}"
        tensors_dir = epoch_dir / "tensors"

        # CPU copy on writer thread
        arr = job.tensor.detach().cpu().numpy()

        # Sanitize path for filename
        safe_name = "".join(
            c if c not in r'/\:*?"<>|' else "_" for c in job.path
        )
        filename = f"{safe_name}__step{job.step:09d}.npy"
        file_path = tensors_dir / filename

        write_npy(file_path, arr)

        # Append index row
        index_row = {
            "path": job.path,
            "step": job.step,
            "samples_seen": job.samples_seen,
            "wall_time": job.wall_time,
            "rank": job.rank,
            "file": filename,
            "shape": list(arr.shape),
            "dtype": str(arr.dtype),
        }
        append_jsonl(tensors_dir / "index.jsonl", index_row)

    def _write_checkpoint(self, job: CheckpointJob) -> None:
        """Write checkpoint (stub for v0)."""
        pass

    def _append_error(self, error: str) -> None:
        """Append an error to meta.json writer_errors."""
        try:
            meta = json.loads(self.meta_path.read_text())
            meta.setdefault("writer_errors", []).append(error)
            atomic_write_bytes(self.meta_path, json.dumps(meta, indent=2).encode())
        except Exception:
            pass
