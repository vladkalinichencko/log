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
        if not path or path == "":
            raise InvalidPathError("path cannot be empty")

        if step is None:
            step = self.ctx.current_step

        wall_time = time.time()
        rank = 0

        is_scalar = False
        if isinstance(value, (int, float, bool)):
            is_scalar = True
        elif isinstance(value, (torch.Tensor, np.ndarray)):
            if isinstance(value, torch.Tensor):
                if value.ndim == 0:
                    is_scalar = True
                    value = value.item()
            elif isinstance(value, np.ndarray):
                if value.ndim == 0:
                    is_scalar = True
                    value = value.item()
        else:
            raise UnsupportedValueTypeError(
                f"value must be scalar or tensor, got {type(value)}"
            )

        if is_scalar:
            job = ScalarJob(
                path=path,
                value=value,
                step=step,
                samples_seen=self.ctx.samples_seen,
                wall_time=wall_time,
                rank=rank,
                epoch=self.ctx.epoch,
            )
        else:
            if isinstance(value, np.ndarray):
                value = torch.from_numpy(value)
            job = TensorJob(
                path=path,
                tensor=value,
                step=step,
                samples_seen=self.ctx.samples_seen,
                wall_time=wall_time,
                rank=rank,
                epoch=self.ctx.epoch,
            )

        self.ctx.writer.enqueue(job)


def logger() -> Logger:
    ctx = get_active_run()
    return Logger(ctx)


def log(
    path: str,
    value: Union[float, int, bool, torch.Tensor, np.ndarray],
    step: int | None = None,
) -> None:
    logger().log(path, value, step)
