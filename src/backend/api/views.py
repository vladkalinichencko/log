import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_runs_root

router = APIRouter()


def _views_dir(runs_root: Path) -> Path:
    return runs_root / "views"


@router.get("/api/views")
def list_views(runs_root: Path = Depends(get_runs_root)) -> list[dict]:
    directory = _views_dir(runs_root)
    if not directory.exists():
        return []
    return [json.loads(p.read_text()) for p in sorted(directory.glob("*.json"))]


@router.put("/api/views/{view_id}")
def save_view(view_id: str, view: dict, runs_root: Path = Depends(get_runs_root)) -> dict:
    directory = _views_dir(runs_root)
    directory.mkdir(parents=True, exist_ok=True)
    final = directory / f"{view_id}.json"
    tmp = directory / f"{view_id}.json.tmp"
    tmp.write_text(json.dumps(view))
    os.replace(tmp, final)
    return view


@router.delete("/api/views/{view_id}")
def delete_view(view_id: str, runs_root: Path = Depends(get_runs_root)) -> dict:
    final = _views_dir(runs_root) / f"{view_id}.json"
    if not final.exists():
        raise HTTPException(status_code=404, detail="VIEW_NOT_FOUND")
    final.unlink()
    return {"deleted": True}
