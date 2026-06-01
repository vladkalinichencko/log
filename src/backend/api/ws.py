from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from watchfiles import awatch

from ..config import get_runs_root

router = APIRouter()


def _runs_changed(paths: list[str], runs_root: Path) -> set[str]:
    runs = set()
    for changed in paths:
        try:
            parts = Path(changed).relative_to(runs_root).parts
        except ValueError:
            continue
        if len(parts) >= 2 and parts[0] != "workspaces":
            runs.add(f"{parts[0]}/{parts[1]}")
    return runs


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    runs_root = get_runs_root()
    runs_root.mkdir(parents=True, exist_ok=True)
    await websocket.send_json({"type": "hello", "runs_root": str(runs_root)})
    try:
        async for changes in awatch(runs_root):
            for run in _runs_changed([changed for _, changed in changes], runs_root):
                await websocket.send_json({"type": "run_updated", "run": run, "kind": "metrics"})
    except WebSocketDisconnect:
        return
