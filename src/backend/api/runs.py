import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_runs_root

router = APIRouter()


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
    run_dir = runs_root / project / run
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="RUN_NOT_FOUND")
    return {"name": run, "kind": "folder", "cells": []}
