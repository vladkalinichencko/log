import torch.nn as nn
import torch.optim as optim


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
    """Save a checkpoint (stub for v0)."""
    raise NotImplementedError
