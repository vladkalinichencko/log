import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_runs_root

router = APIRouter()


def _workspaces_dir(runs_root: Path) -> Path:
    return runs_root / "workspaces"


@router.get("/api/workspaces")
def list_workspaces(runs_root: Path = Depends(get_runs_root)) -> list[dict]:
    directory = _workspaces_dir(runs_root)
    if not directory.exists():
        return []
    return [json.loads(p.read_text()) for p in sorted(directory.glob("*.json"))]


@router.put("/api/workspaces/{workspace_id}")
def save_workspace(
    workspace_id: str, workspace: dict, runs_root: Path = Depends(get_runs_root)
) -> dict:
    directory = _workspaces_dir(runs_root)
    directory.mkdir(parents=True, exist_ok=True)
    final = directory / f"{workspace_id}.json"
    tmp = directory / f"{workspace_id}.json.tmp"
    tmp.write_text(json.dumps(workspace))
    os.replace(tmp, final)
    return workspace


@router.delete("/api/workspaces/{workspace_id}")
def delete_workspace(
    workspace_id: str, runs_root: Path = Depends(get_runs_root)
) -> dict:
    final = _workspaces_dir(runs_root) / f"{workspace_id}.json"
    if not final.exists():
        raise HTTPException(status_code=404, detail="WORKSPACE_NOT_FOUND")
    final.unlink()
    return {"deleted": True}
