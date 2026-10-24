from pathlib import Path

from fastapi import APIRouter, Depends

from ..adapters.json_store import delete_document, list_documents, save_document
from ..config import get_runs_root
from .errors import ApiError

router = APIRouter()


@router.get("/api/workspaces")
def list_workspaces(runs_root: Path = Depends(get_runs_root)) -> list[dict]:
    return list_documents(runs_root / "workspaces")


@router.put("/api/workspaces/{workspace_id}")
def save_workspace(workspace_id: str, workspace: dict, runs_root: Path = Depends(get_runs_root)) -> dict:
    return save_document(runs_root / "workspaces", workspace_id, workspace)


@router.delete("/api/workspaces/{workspace_id}")
def delete_workspace(workspace_id: str, runs_root: Path = Depends(get_runs_root)) -> dict:
    if not delete_document(runs_root / "workspaces", workspace_id):
        raise ApiError(404, "WORKSPACE_NOT_FOUND", f"workspace {workspace_id!r} does not exist")
    return {"deleted": True}
