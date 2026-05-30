import torch.nn as nn


class WatchHandle:
    """Handle for registered watch hooks."""

    def __init__(self):
        pass

    def remove(self) -> None:
        """Remove registered hooks (stub for v0)."""
        raise NotImplementedError


def watch(
    model: nn.Module,
    paths: list[str] | None = None,
    log_activations: bool = True,
    log_gradients: bool = False,
) -> WatchHandle:
    """Register hooks to log module activations/gradients (stub for v0)."""
    raise NotImplementedError
