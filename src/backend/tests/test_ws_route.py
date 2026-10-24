from fastapi.testclient import TestClient

from backend.main import app


def test_ws_sends_hello_on_connect(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as socket:
            hello = socket.receive_json()
    assert hello["type"] == "hello"
    assert hello["runs_root"] == str(tmp_path)


def test_ws_subscribe_scopes_events_and_unknown_messages_answer_an_error(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as socket:
            socket.receive_json()
            socket.send_json({"type": "subscribe", "run": "p/a"})
            assert socket.receive_json() == {"type": "subscribed", "run": "p/a"}
            socket.send_json({"type": "ping"})
            assert socket.receive_json()["type"] == "error"
            assert list(app.state.transport.subscriptions.values()) == [{"p/a"}]
