import weakref

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
    get_active_run()
    handles = []
    for name, module in model.named_modules():
        if name == "" or (paths is not None and name not in paths):
            continue
        if log_activations:
            def forward_hook(_m, _inp, out, _name=name):
                if isinstance(out, torch.Tensor):
                    log(_name, out.detach())

            handles.append(module.register_forward_hook(forward_hook))
        if log_gradients:
            def backward_hook(_m, grad_in, grad_out, _name=name):
                if grad_out and isinstance(grad_out[0], torch.Tensor):
                    log(f"{_name}.grad", grad_out[0].detach())

            handles.append(module.register_full_backward_hook(backward_hook))
    return WatchHandle(model, handles)
