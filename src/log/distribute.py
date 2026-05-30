import torch.nn as nn


def distribute(
    model: nn.Module,
    strategy: str = "auto",
    find_unused_parameters: bool = False,
) -> nn.Module:
    """Wrap model for distributed training (stub for v0)."""
    raise NotImplementedError
