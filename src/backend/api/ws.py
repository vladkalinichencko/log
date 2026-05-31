from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "hello", "runs_root": "./runs"})
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
