import time
from typing import Union

import numpy as np
import torch

from .errors import InvalidPathError, UnsupportedValueTypeError
from .run import get_active_run, RunContext
from .writer.queue_writer import ScalarJob, TensorJob


class Logger:

    def __init__(self, ctx: RunContext):
        self.ctx = ctx

    def log(
        self,
        path: str,
        value: Union[float, int, bool, torch.Tensor, np.ndarray],
        step: int | None = None,
    ) -> None:
        if not path:
            raise InvalidPathError("path cannot be empty")
        if not isinstance(value, (int, float, bool, torch.Tensor, np.ndarray)):
            raise UnsupportedValueTypeError(f"value must be scalar or tensor, got {type(value)}")

        if step is None:
            step = self.ctx.current_step
        else:
            self.ctx.current_step = step
        if isinstance(value, (torch.Tensor, np.ndarray)) and value.ndim == 0:
            value = value.item()

        stamp = dict(step=step, samples_seen=self.ctx.samples_seen, wall_time=time.time(), rank=0, epoch=self.ctx.epoch)
        if isinstance(value, (int, float, bool)):
            self.ctx.writer.enqueue(ScalarJob(path=path, value=value, **stamp))
        else:
            self.ctx.writer.enqueue(TensorJob(path=path, tensor=torch.as_tensor(value), **stamp))


def logger() -> Logger:
    ctx = get_active_run()
    return Logger(ctx)


def log(
    path: str,
    value: Union[float, int, bool, torch.Tensor, np.ndarray],
    step: int | None = None,
) -> None:
    logger().log(path, value, step)
