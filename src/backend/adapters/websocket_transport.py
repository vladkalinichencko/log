from fastapi import WebSocket


class WebSocketTransport:

    def __init__(self):
        self.sockets: set[WebSocket] = set()

    def add(self, socket: WebSocket) -> None:
        self.sockets.add(socket)

    def remove(self, socket: WebSocket) -> None:
        self.sockets.discard(socket)

    async def push(self, event: dict) -> None:
        for socket in list(self.sockets):
            await socket.send_json(event)
