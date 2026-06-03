from fastapi.testclient import TestClient

from backend.main import app


def test_ws_sends_hello_on_connect(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as socket:
            hello = socket.receive_json()
    assert hello["type"] == "hello"
    assert hello["runs_root"] == str(tmp_path)
