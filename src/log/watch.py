import torch.nn as nn


class WatchHandle:

    def __init__(self):
        pass

    def remove(self) -> None:
        raise NotImplementedError


def watch(
    model: nn.Module,
    paths: list[str] | None = None,
    log_activations: bool = True,
    log_gradients: bool = False,
) -> WatchHandle:
    raise NotImplementedError
