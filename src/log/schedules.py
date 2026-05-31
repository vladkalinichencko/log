import torch.optim as optim
from torch.optim.lr_scheduler import LambdaLR


def warmup_cosine(
    optimizer: optim.Optimizer,
    warmup: int,
    total: int,
    min_lr_ratio: float = 0.0,
) -> LambdaLR:
    raise NotImplementedError


def warmup_linear(
    optimizer: optim.Optimizer,
    warmup: int,
    total: int,
    min_lr_ratio: float = 0.0,
) -> LambdaLR:
    raise NotImplementedError


def warmup_constant(
    optimizer: optim.Optimizer,
    warmup: int,
) -> LambdaLR:
    raise NotImplementedError
