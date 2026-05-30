import numpy as np
from pathlib import Path


def write_npy(path: Path, array: np.ndarray) -> None:
    """Write NumPy array to .npy file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, array)


def read_npy(path: Path) -> np.ndarray:
    """Read .npy file, optionally memory-mapped."""
    return np.load(path, mmap_mode="r")
