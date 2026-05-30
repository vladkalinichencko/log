import json
import os
import tempfile
from pathlib import Path


def atomic_write_bytes(path: Path, data: bytes) -> None:
    """Write data to path atomically via temp file + os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        os.write(fd, data)
        os.close(fd)
        os.replace(tmp_path, path)
    except Exception:
        os.close(fd)
        if Path(tmp_path).exists():
            Path(tmp_path).unlink()
        raise


def append_jsonl(path: Path, row: dict) -> None:
    """Append one JSON line to path and flush."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")
        f.flush()
