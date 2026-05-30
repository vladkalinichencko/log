from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint (stub for v0)."""
    await websocket.accept()
    await websocket.send_json({"type": "hello", "runs_root": "./runs"})
    # Keep connection open but do nothing
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
