import torch.utils.data as data


class TrackedLoader:
    """Wrapper for DataLoader that tracks samples_seen (stub for v0)."""

    def __init__(self, loader: data.DataLoader):
        self.inner = loader

    def __iter__(self):
        raise NotImplementedError

    def __len__(self):
        return len(self.inner)


def track(loader: data.DataLoader) -> TrackedLoader:
    """Wrap a DataLoader to track samples_seen (stub for v0)."""
    raise NotImplementedError
