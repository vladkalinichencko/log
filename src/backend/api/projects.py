from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..adapters.json_store import save_document
from ..config import get_runs_root
from ..domain.project_settings import PROJECT_SETTINGS_FILE, read_project_settings
from .errors import ApiError

router = APIRouter()


class ProjectSettings(BaseModel):
    hero: str | None
    alerts: dict[str, bool]


def _project_dir(project: str, runs_root: Path) -> Path:
    project_dir = runs_root / project
    if not project_dir.is_dir():
        raise ApiError(404, "PROJECT_NOT_FOUND", f"project {project!r} does not exist")
    return project_dir


@router.get("/api/projects/{project}/settings")
def get_project_settings(project: str, runs_root: Path = Depends(get_runs_root)) -> ProjectSettings:
    return ProjectSettings(**read_project_settings(_project_dir(project, runs_root)))


@router.put("/api/projects/{project}/settings")
def save_project_settings(project: str, settings: ProjectSettings, runs_root: Path = Depends(get_runs_root)) -> ProjectSettings:
    project_dir = _project_dir(project, runs_root)
    save_document(project_dir, PROJECT_SETTINGS_FILE.removesuffix(".json"), settings.model_dump())
    return ProjectSettings(**read_project_settings(project_dir))
