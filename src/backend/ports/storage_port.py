from pathlib import Path
from typing import Protocol


class StoragePort(Protocol):

    def read(self, path: Path) -> bytes:
        ...

    def list_dir(self, path: Path) -> list[str]:
        ...
