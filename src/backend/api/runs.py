import shutil
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..config import get_index, get_runs_root
from ..ports.index_port import IndexPort

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
    index: IndexPort = Depends(get_index),
    project: str | None = None,
    status: str | None = None,
    tag: str | None = None,
) -> list[dict]:
    return [asdict(run) for run in index.query(project, status, tag)]


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
