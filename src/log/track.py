import torch
import torch.utils.data as data

from .errors import NotADataLoaderError
from .run import get_active_run


def _batch_size(batch) -> int:
    if isinstance(batch, torch.Tensor):
        return batch.shape[0]
    if isinstance(batch, (list, tuple)) and batch and isinstance(batch[0], torch.Tensor):
        return batch[0].shape[0]
    return 1


class TrackedLoader:
    def __init__(self, loader: data.DataLoader):
        self.inner = loader

    def __iter__(self):
        ctx = get_active_run()
        for batch in self.inner:
            ctx.samples_seen += _batch_size(batch)
            yield batch

    def __len__(self):
        return len(self.inner)


def track(loader: data.DataLoader) -> TrackedLoader:
    get_active_run()
    if not isinstance(loader, data.DataLoader):
        raise NotADataLoaderError(f"expected a DataLoader, got {type(loader)}")
    return TrackedLoader(loader)
