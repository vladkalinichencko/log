import numpy as np
from pathlib import Path


def write_npy(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, array)


def read_npy(path: Path) -> np.ndarray:
    return np.load(path, mmap_mode="r")
