from pathlib import Path


class LocalFileStorage:
    """Local filesystem storage adapter."""

    def __init__(self, root: Path):
        self.root = root

    def read(self, path: Path) -> bytes:
        """Read file bytes."""
        return (self.root / path).read_bytes()

    def list_dir(self, path: Path) -> list[str]:
        """List directory contents."""
        dir_path = self.root / path
        if not dir_path.exists():
            return []
        return [p.name for p in dir_path.iterdir()]
