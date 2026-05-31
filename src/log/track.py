import torch.utils.data as data


class TrackedLoader:

    def __init__(self, loader: data.DataLoader):
        self.inner = loader

    def __iter__(self):
        raise NotImplementedError

    def __len__(self):
        return len(self.inner)


def track(loader: data.DataLoader) -> TrackedLoader:
    raise NotImplementedError
