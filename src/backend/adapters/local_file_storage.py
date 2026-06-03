from pathlib import Path

import numpy as np


class LocalFileStorage:

    def __init__(self, root: Path):
        self.root = root

    def read(self, path: str) -> bytes:
        return (self.root / path).read_bytes()

    def read_array(self, path: str) -> np.ndarray:
        return np.load(self.root / path, mmap_mode="r")

    def list_dir(self, path: str) -> list[str]:
        directory = self.root / path
        return [p.name for p in directory.iterdir()] if directory.exists() else []

    def is_dir(self, path: str) -> bool:
        return (self.root / path).is_dir()

    def exists(self, path: str) -> bool:
        return (self.root / path).exists()
