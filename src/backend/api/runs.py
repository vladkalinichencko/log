import json
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..config import get_runs_root
from ..domain.read_table import read_table
from .tables import _table_to_dict

router = APIRouter()


def rename_names(
    names: list[str], prefix: str = "", suffix: str = "", find: str = "", replace: str = ""
) -> list[str]:
    return [prefix + (n.replace(find, replace) if find else n) + suffix for n in names]


class RenameRequest(BaseModel):
    run_refs: list[str]
    prefix: str = ""
    suffix: str = ""
    find: str = ""
    replace: str = ""


@router.get("/api/runs")
def get_runs(
    runs_root: Path = Depends(get_runs_root),
    project: str | None = None,
    status: str | None = None,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    result = []
    if not runs_root.exists():
        return result

    for project_dir in runs_root.iterdir():
        if not project_dir.is_dir() or project_dir.name.startswith("."):
            continue
        if project is not None and project_dir.name != project:
            continue
        for run_dir in project_dir.iterdir():
            if not run_dir.is_dir() or run_dir.name.startswith("."):
                continue
            meta_path = run_dir / "meta.json"
            config_path = run_dir / "config.json"

            if meta_path.exists():
                meta = json.loads(meta_path.read_text())
            else:
                meta = {}

            if config_path.exists():
                config = json.loads(config_path.read_text())
            else:
                config = {}

            if status is not None and meta.get("status") != status:
                continue
            if tag is not None and tag not in meta.get("tags", []):
                continue

            result.append(
                {
                    "project": project_dir.name,
                    "name": run_dir.name,
                    "status": meta.get("status", "unknown"),
                    "samples_seen": meta.get("samples_seen", 0),
                    "start_wall_time": meta.get("start_wall_time"),
                    "config": config.get("params", {}),
                }
            )

    return result


@router.get("/api/runs/{project}/{run}")
def get_run(project: str, run: str, runs_root: Path = Depends(get_runs_root)) -> dict:
    try:
        return _table_to_dict(read_table(f"{project}.{run}", runs_root))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="RUN_NOT_FOUND")


@router.delete("/api/runs/{project}/{run}")
def delete_run(project: str, run: str, runs_root: Path = Depends(get_runs_root)) -> dict:
    run_dir = runs_root / project / run
    if not run_dir.is_dir():
        raise HTTPException(status_code=404, detail="RUN_NOT_FOUND")
    shutil.rmtree(run_dir)
    return {"deleted": True}


@router.post("/api/runs/rename")
def rename_runs(req: RenameRequest, runs_root: Path = Depends(get_runs_root)) -> dict:
    renamed = {}
    for ref in req.run_refs:
        project, run = ref.split("/", 1)
        new_run = rename_names([run], req.prefix, req.suffix, req.find, req.replace)[0]
        if new_run == run:
            continue
        src = runs_root / project / run
        dst = runs_root / project / new_run
        if not src.is_dir():
            raise HTTPException(status_code=404, detail="RUN_NOT_FOUND")
        if dst.exists():
            raise HTTPException(status_code=400, detail="INVALID_PATTERN")
        src.rename(dst)
        renamed[ref] = f"{project}/{new_run}"
    return {"renamed": renamed}
