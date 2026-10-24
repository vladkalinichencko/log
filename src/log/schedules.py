import math
from typing import Callable

import torch.optim as optim
from torch.optim.lr_scheduler import LambdaLR

from .errors import InvalidScheduleArgsError


def warmup_cosine(
    optimizer: optim.Optimizer, warmup: int, total: int, min_lr_ratio: float = 0.0
) -> LambdaLR:
    return _warmup_then(optimizer, warmup, total, min_lr_ratio, lambda progress: 0.5 * (1 + math.cos(math.pi * progress)))


def warmup_linear(
    optimizer: optim.Optimizer, warmup: int, total: int, min_lr_ratio: float = 0.0
) -> LambdaLR:
    return _warmup_then(optimizer, warmup, total, min_lr_ratio, lambda progress: 1 - progress)


def warmup_constant(optimizer: optim.Optimizer, warmup: int) -> LambdaLR:
    if warmup < 0:
        raise InvalidScheduleArgsError(f"need warmup>=0, got {warmup}")
    return LambdaLR(optimizer, lambda step: _warmup_factor(step, warmup))


def _warmup_then(
    optimizer: optim.Optimizer, warmup: int, total: int, min_lr_ratio: float, decay: Callable[[float], float]
) -> LambdaLR:
    if warmup < 0 or total <= warmup or not 0.0 <= min_lr_ratio <= 1.0:
        raise InvalidScheduleArgsError(
            f"need warmup>=0, total>warmup, min_lr_ratio in [0,1]; "
            f"got warmup={warmup}, total={total}, min_lr_ratio={min_lr_ratio}"
        )

    def factor(step: int) -> float:
        if step < warmup:
            return _warmup_factor(step, warmup)
        progress = min(1.0, (step - warmup) / (total - warmup))
        return min_lr_ratio + (1 - min_lr_ratio) * decay(progress)

    return LambdaLR(optimizer, factor)


def _warmup_factor(step: int, warmup: int) -> float:
    return (step + 1) / warmup if step < warmup else 1.0
