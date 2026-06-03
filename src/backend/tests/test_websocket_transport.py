import asyncio

from backend.adapters.websocket_transport import WebSocketTransport


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def send_json(self, event):
        self.sent.append(event)


def test_push_broadcasts_to_all():
    transport = WebSocketTransport()
    a, b = FakeSocket(), FakeSocket()
    transport.add(a)
    transport.add(b)
    asyncio.run(transport.push({"type": "run_updated"}))
    assert a.sent == [{"type": "run_updated"}]
    assert b.sent == [{"type": "run_updated"}]


def test_removed_socket_gets_nothing():
    transport = WebSocketTransport()
    socket = FakeSocket()
    transport.add(socket)
    transport.remove(socket)
    asyncio.run(transport.push({"type": "run_updated"}))
    assert socket.sent == []
