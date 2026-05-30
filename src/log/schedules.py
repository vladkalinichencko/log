import torch.optim as optim
from torch.optim.lr_scheduler import LambdaLR


def warmup_cosine(
    optimizer: optim.Optimizer,
    warmup: int,
    total: int,
    min_lr_ratio: float = 0.0,
) -> LambdaLR:
    """Cosine LR schedule with warmup (stub for v0)."""
    raise NotImplementedError


def warmup_linear(
    optimizer: optim.Optimizer,
    warmup: int,
    total: int,
    min_lr_ratio: float = 0.0,
) -> LambdaLR:
    """Linear LR schedule with warmup (stub for v0)."""
    raise NotImplementedError


def warmup_constant(
    optimizer: optim.Optimizer,
    warmup: int,
) -> LambdaLR:
    """Constant LR after warmup (stub for v0)."""
    raise NotImplementedError
