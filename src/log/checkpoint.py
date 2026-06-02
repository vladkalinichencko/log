import torch.nn as nn
import torch.optim as optim

from .errors import CheckpointStateError, InvalidModeError
from .run import get_active_run
from .writer.identity import capture_rng
from .writer.queue_writer import CheckpointJob


def checkpoint(
    model: nn.Module,
    optimizer: optim.Optimizer | None = None,
    scheduler: object | None = None,
    every: int = 1000,
    keep_top_k: int = 5,
    metric: str | None = "loss",
    mode: str = "min",
    tag: str | None = None,
) -> bool:
    ctx = get_active_run()
    if mode not in {"min", "max"}:
        raise InvalidModeError(f"mode must be min|max, got {mode!r}")

    step = ctx.current_step
    if every > 0 and step % every != 0:
        return False

    try:
        payload = {
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict() if optimizer is not None else None,
            "scheduler": scheduler.state_dict() if scheduler is not None else None,
            "rng": capture_rng(),
            "step": step,
            "epoch": ctx.epoch,
            "samples_seen": ctx.samples_seen,
            "config": ctx.config,
        }
    except Exception as e:
        raise CheckpointStateError(f"state_dict() failed: {e}") from e

    ctx.writer.enqueue(
        CheckpointJob(
            payload=payload,
            tag=tag or f"step{step:09d}",
            run_dir=ctx.run_dir,
            epoch=ctx.epoch,
            metric=metric,
            mode=mode,
            keep_top_k=keep_top_k,
        )
    )
    return True
