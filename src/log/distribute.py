import torch.nn as nn


def distribute(
    model: nn.Module,
    strategy: str = "auto",
    find_unused_parameters: bool = False,
) -> nn.Module:
    raise NotImplementedError
