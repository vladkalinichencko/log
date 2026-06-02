import json
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim

from .errors import CheckpointReadError, StateRestoreError
from .run import get_active_run
from .writer.atomic import atomic_write_bytes
from .writer.identity import restore_rng


def resume_state(
    model: nn.Module,
    optimizer: optim.Optimizer | None = None,
    scheduler: object | None = None,
    checkpoint: str | None = None,
) -> int:
    ctx = get_active_run()
    ckpt_dir = ctx.run_dir / "checkpoints"

    if checkpoint is not None:
        ckpt_path = Path(checkpoint)
    else:
        index_path = ckpt_dir / "index.jsonl"
        rows = [
            json.loads(line)
            for line in index_path.read_text().splitlines()
            if line.strip()
        ] if index_path.exists() else []
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

    meta_path = ctx.run_dir / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["resume_diff"] = {"resumed_from_step": payload["step"]}
    atomic_write_bytes(meta_path, json.dumps(meta, indent=2).encode())
    return payload["step"]
