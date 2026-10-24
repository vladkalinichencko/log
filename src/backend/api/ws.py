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
            message = await websocket.receive_json()
            if message.get("type") == "subscribe":
                transport.subscribe(websocket, message["run"])
                await websocket.send_json({"type": "subscribed", "run": message["run"]})
            else:
                await websocket.send_json({"type": "error", "message": f"unknown message {message.get('type')!r}"})
    except WebSocketDisconnect:
        transport.remove(websocket)
