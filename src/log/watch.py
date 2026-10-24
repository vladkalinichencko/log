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
    for name, module in model.named_modules():
        path = name or "model"
        if paths is not None and not any(fnmatchcase(path, pattern) for pattern in paths):
            continue
        if log_activations:
            def forward_hook(_m, _inp, out, _path=path):
                if isinstance(out, torch.Tensor):
                    log(_path, out.detach())

            handles.append(module.register_forward_hook(forward_hook))
        if log_gradients:
            def backward_hook(_m, grad_in, grad_out, _path=path):
                if grad_out and isinstance(grad_out[0], torch.Tensor):
                    log(f"{_path}.grad", grad_out[0].detach())

            handles.append(module.register_full_backward_hook(backward_hook))
    handle = WatchHandle(model, handles)
    ctx.watch_handles.append(handle)
    return handle
