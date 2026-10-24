import json
import os
from pathlib import Path


def list_documents(directory: Path) -> list[dict]:
    return [json.loads(path.read_text()) for path in sorted(directory.glob("*.json"))]


def save_document(directory: Path, document_id: str, document: dict) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / f"{document_id}.json.tmp"
    temporary.write_text(json.dumps(document))
    os.replace(temporary, directory / f"{document_id}.json")
    return document


def delete_document(directory: Path, document_id: str) -> bool:
    path = directory / f"{document_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True
