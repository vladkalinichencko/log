from fastapi import WebSocket


class WebSocketTransport:

    def __init__(self):
        self.subscriptions: dict[WebSocket, set[str]] = {}

    def add(self, socket: WebSocket) -> None:
        self.subscriptions[socket] = set()

    def subscribe(self, socket: WebSocket, run: str) -> None:
        self.subscriptions[socket].add(run)

    def remove(self, socket: WebSocket) -> None:
        self.subscriptions.pop(socket, None)

    async def push(self, event: dict) -> None:
        for socket, runs in list(self.subscriptions.items()):
            if not runs or event["run"] in runs:
                await socket.send_json(event)
