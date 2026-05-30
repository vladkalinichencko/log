import torch.nn as nn
import torch.optim as optim


def resume_state(
    model: nn.Module,
    optimizer: optim.Optimizer | None = None,
    scheduler: object | None = None,
    checkpoint: str | None = None,
) -> int:
    """Restore training state from checkpoint (stub for v0)."""
    raise NotImplementedError
