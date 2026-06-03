from typing import Protocol

import numpy as np


class StoragePort(Protocol):

    def read(self, path: str) -> bytes:
        ...

    def read_array(self, path: str) -> np.ndarray:
        ...

    def list_dir(self, path: str) -> list[str]:
        ...

    def is_dir(self, path: str) -> bool:
        ...

    def exists(self, path: str) -> bool:
        ...
