import weakref
from fnmatch import fnmatchcase

import torch
import torch.nn as nn

from .logger import log
from .run import get_active_run


class WatchHandle:
    def __init__(self, model: nn.Module, handles: list):
        self.model = weakref.ref(model)
        self._handles = handles

    def remove(self) -> None:
        for handle in self._handles:
            handle.remove()
        self._handles = []


def watch(
    model: nn.Module,
    paths: list[str] | None = None,
    log_activations: bool = True,
    log_gradients: bool = False,
) -> WatchHandle:
    ctx = get_active_run()
    handles = []
    calls: dict[str, tuple[tuple[int, int], int]] = {}

    def record(path: str, tensor: torch.Tensor) -> None:
        moment = (ctx.epoch, ctx.current_step)
        seen_at, count = calls.get(path, (moment, 0))
        count = count + 1 if seen_at == moment else 1
        calls[path] = (moment, count)
        log(path if count == 1 else f"{path}@{count}", tensor.detach())
    for name, module in model.named_modules():
        path = name or "model"
        if paths is not None and not any(fnmatchcase(path, pattern) for pattern in paths):
            continue
        if log_activations:
            def forward_hook(_m, _inp, out, _path=path):
                if isinstance(out, torch.Tensor):
                    record(_path, out)

            handles.append(module.register_forward_hook(forward_hook))
        if log_gradients:
            def backward_hook(_m, grad_in, grad_out, _path=path):
                if grad_out and isinstance(grad_out[0], torch.Tensor):
                    record(f"{_path}.grad", grad_out[0])

            handles.append(module.register_full_backward_hook(backward_hook))
    handle = WatchHandle(model, handles)
    ctx.watch_handles.append(handle)
    return handle
