from pathlib import Path

from fastapi import APIRouter, Depends

from ..adapters.json_store import delete_document, list_documents, save_document
from ..config import get_runs_root
from .errors import ApiError

router = APIRouter()


@router.get("/api/views")
def list_views(runs_root: Path = Depends(get_runs_root)) -> list[dict]:
    return list_documents(runs_root / "views")


@router.put("/api/views/{view_id}")
def save_view(view_id: str, view: dict, runs_root: Path = Depends(get_runs_root)) -> dict:
    return save_document(runs_root / "views", view_id, view)


@router.delete("/api/views/{view_id}")
def delete_view(view_id: str, runs_root: Path = Depends(get_runs_root)) -> dict:
    if not delete_document(runs_root / "views", view_id):
        raise ApiError(404, "VIEW_NOT_FOUND", f"view {view_id!r} does not exist")
    return {"deleted": True}
