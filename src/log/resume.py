from pathlib import Path

from typing import Any

import torch
import torch.nn as nn
import torch.optim as optim

from .errors import CheckpointReadError, StateRestoreError
from .run import get_active_run
from .writer.atomic import read_jsonl
from .writer.identity import restore_rng
from .writer.queue_writer import MetaJob


def resume_state(
    model: nn.Module,
    optimizer: optim.Optimizer | None = None,
    scheduler: Any | None = None,
    checkpoint: str | None = None,
) -> int:
    ctx = get_active_run()
    ckpt_dir = ctx.run_dir / "checkpoints"

    if checkpoint is not None:
        ckpt_path = Path(checkpoint)
    else:
        rows = read_jsonl(ckpt_dir / "index.jsonl")
        if not rows:
            return 0
        ckpt_path = ckpt_dir / f"{max(rows, key=lambda r: r['step'])['tag']}.pt"

    if not ckpt_path.exists():
        return 0

    try:
        payload = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    except Exception as e:
        raise CheckpointReadError(f"cannot read checkpoint {ckpt_path}: {e}") from e

    try:
        model.load_state_dict(payload["model"])
        if optimizer is not None and payload.get("optimizer") is not None:
            optimizer.load_state_dict(payload["optimizer"])
        if scheduler is not None and payload.get("scheduler") is not None:
            scheduler.load_state_dict(payload["scheduler"])
    except Exception as e:
        raise StateRestoreError(f"load_state_dict failed: {e}") from e

    if "rng" in payload:
        restore_rng(payload["rng"])
    ctx.samples_seen = payload.get("samples_seen", 0)
    ctx.epoch = payload.get("epoch", 0)
    ctx.current_step = payload["step"]
    source_run = ckpt_path.resolve().parent.parent
    resumed_from = {} if source_run == ctx.run_dir.resolve() else {"resumed_from_run": f"{source_run.parent.name}.{source_run.name}"}
    ctx.writer.enqueue(MetaJob({"resume_diff": {"resumed_from_step": payload["step"], **resumed_from}}))
    return payload["step"]
