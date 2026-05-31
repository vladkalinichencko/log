from pathlib import Path


class LocalFileStorage:

    def __init__(self, root: Path):
        self.root = root

    def read(self, path: Path) -> bytes:
        return (self.root / path).read_bytes()

    def list_dir(self, path: Path) -> list[str]:
        dir_path = self.root / path
        if not dir_path.exists():
            return []
        return [p.name for p in dir_path.iterdir()]
