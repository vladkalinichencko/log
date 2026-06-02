import os

import torch
import torch.distributed as dist
import torch.nn as nn

from .errors import DistributedInitError, InvalidStrategyError


def distribute(
    model: nn.Module,
    strategy: str = "auto",
    find_unused_parameters: bool = False,
) -> nn.Module:
    if strategy not in {"auto", "ddp", "fsdp"}:
        raise InvalidStrategyError(f"strategy must be auto|ddp|fsdp, got {strategy!r}")

    if int(os.environ.get("WORLD_SIZE", "1")) <= 1:
        return model

    try:
        if not dist.is_initialized():
            dist.init_process_group(backend="nccl" if torch.cuda.is_available() else "gloo")
    except Exception as e:
        raise DistributedInitError(f"init_process_group failed: {e}") from e

    if strategy == "fsdp":
        from torch.distributed.fsdp import FullyShardedDataParallel

        return FullyShardedDataParallel(model)
    return nn.parallel.DistributedDataParallel(
        model, find_unused_parameters=find_unused_parameters
    )
