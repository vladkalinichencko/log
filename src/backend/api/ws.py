from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import get_runs_root

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    transport = websocket.app.state.transport
    await websocket.send_json({"type": "hello", "runs_root": str(get_runs_root())})
    transport.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        transport.remove(websocket)
