import json
import os
import tempfile
from pathlib import Path


def atomic_write_bytes(path: Path, data: bytes) -> None:
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


def update_json(path: Path, fields: dict) -> None:
    document = json.loads(path.read_text())
    document.update(fields)
    atomic_write_bytes(path, json.dumps(document, indent=2).encode())


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")
        f.flush()


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
