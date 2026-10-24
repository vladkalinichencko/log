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


def test_subscribed_socket_gets_only_its_runs():
    transport = WebSocketTransport()
    everything, scoped = FakeSocket(), FakeSocket()
    transport.add(everything)
    transport.add(scoped)
    transport.subscribe(scoped, "p/a")
    asyncio.run(transport.push({"type": "run_updated", "run": "p/b"}))
    asyncio.run(transport.push({"type": "run_updated", "run": "p/a"}))
    assert [event["run"] for event in everything.sent] == ["p/b", "p/a"]
    assert [event["run"] for event in scoped.sent] == ["p/a"]


def test_removed_socket_gets_nothing():
    transport = WebSocketTransport()
    socket = FakeSocket()
    transport.add(socket)
    transport.remove(socket)
    asyncio.run(transport.push({"type": "run_updated"}))
    assert socket.sent == []
