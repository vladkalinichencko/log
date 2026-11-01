import time
from typing import Union

import numpy as np
import torch

from .alerts import Action, Check
from .errors import InvalidPathError, UnsupportedValueTypeError
from .run import get_active_run, RunContext
from .writer.queue_writer import RowJob, ScalarJob, TensorJob


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

        stamp = {
            "step": int(step),
            "samples_seen": int(self.ctx.samples_seen),
            "wall_time": time.time(),
            "rank": 0,
            "epoch": int(self.ctx.epoch),
        }
        if isinstance(value, (int, float, bool)):
            self.ctx.writer.enqueue(ScalarJob(path=path, value=value, **stamp))
            if not isinstance(value, bool):
                for row in self.ctx.alerts.observe(path, float(value), stamp):
                    self.ctx.writer.enqueue(RowJob(file="alerts.jsonl", row=row, epoch=stamp["epoch"]))
                    for action in self.ctx.alerts.actions:
                        action(row)
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


def alert(path: str, check: Check) -> None:
    get_active_run().alerts.checks.setdefault(path, {})[check.__name__] = check


def on_alert(action: Action) -> None:
    get_active_run().alerts.actions.append(action)
