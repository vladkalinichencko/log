import asyncio
from typing import cast

from fastapi import WebSocket

from backend.adapters.websocket_transport import WebSocketTransport


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def send_json(self, event):
        self.sent.append(event)


def test_push_broadcasts_to_all():
    transport = WebSocketTransport()
    a, b = FakeSocket(), FakeSocket()
    transport.add(cast(WebSocket, a))
    transport.add(cast(WebSocket, b))
    asyncio.run(transport.push({"type": "run_updated"}))
    assert a.sent == [{"type": "run_updated"}]
    assert b.sent == [{"type": "run_updated"}]


def test_subscribed_socket_gets_only_its_runs():
    transport = WebSocketTransport()
    everything, scoped = FakeSocket(), FakeSocket()
    transport.add(cast(WebSocket, everything))
    transport.add(cast(WebSocket, scoped))
    transport.subscribe(cast(WebSocket, scoped), "p/a")
    asyncio.run(transport.push({"type": "run_updated", "run": "p/b"}))
    asyncio.run(transport.push({"type": "run_updated", "run": "p/a"}))
    assert [event["run"] for event in everything.sent] == ["p/b", "p/a"]
    assert [event["run"] for event in scoped.sent] == ["p/a"]


def test_removed_socket_gets_nothing():
    transport = WebSocketTransport()
    socket = FakeSocket()
    transport.add(cast(WebSocket, socket))
    transport.remove(cast(WebSocket, socket))
    asyncio.run(transport.push({"type": "run_updated"}))
    assert socket.sent == []
