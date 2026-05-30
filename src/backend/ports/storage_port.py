from pathlib import Path
from typing import Protocol


class StoragePort(Protocol):
    """Protocol for backend storage operations."""

    def read(self, path: Path) -> bytes:
        ...

    def list_dir(self, path: Path) -> list[str]:
        ...
