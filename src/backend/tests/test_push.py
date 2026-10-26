import asyncio
import base64
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import http_ece
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi.testclient import TestClient

from backend.adapters.file_watcher import FileWatcher
from backend.adapters.sqlite_index import SqliteIndex
from backend.adapters.web_push import WebPushTransport
from backend.main import app


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _browser_subscription(endpoint: str):
    private_key = ec.generate_private_key(ec.SECP256R1())
    auth = os.urandom(16)
    public = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return private_key, auth, {"endpoint": endpoint, "keys": {"p256dh": _b64(public), "auth": _b64(auth)}}


class PushService(BaseHTTPRequestHandler):
    received: list[tuple] = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        PushService.received.append((self.path, body, self.headers))
        self.send_response(410 if self.path == "/expired" else 201)
        self.end_headers()

    def log_message(self, *args):
        pass


def test_the_route_hands_out_one_stable_key_and_keeps_one_subscription_per_endpoint(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    _, _, subscription = _browser_subscription("https://push.example/a")
    with TestClient(app) as client:
        key = client.get("/api/push/key").json()["key"]
        client.put("/api/push/subscriptions", json=subscription)
        client.put("/api/push/subscriptions", json=subscription)
        stored = json.loads((tmp_path / "push.json").read_text())["subscriptions"]
        assert client.get("/api/push/key").json()["key"] == key
        client.request("DELETE", "/api/push/subscriptions", json={"endpoint": "https://push.example/a"})
    assert len(base64.urlsafe_b64decode(key + "=")) == 65
    assert stored == [subscription]
    assert json.loads((tmp_path / "push.json").read_text())["subscriptions"] == []


def test_a_new_alert_row_reaches_every_subscribed_browser_encrypted_and_an_expired_one_is_dropped(tmp_path):
    server = HTTPServer(("127.0.0.1", 0), PushService)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    private_key, auth, live = _browser_subscription(f"{base}/live")
    _, _, expired = _browser_subscription(f"{base}/expired")
    push = WebPushTransport(tmp_path)
    push.subscribe(live)
    push.subscribe(expired)
    run = tmp_path / "p" / "r"
    (run / "epoch_0000").mkdir(parents=True)
    (run / "meta.json").write_text(json.dumps({"status": "running", "samples_seen": 0}))
    index = SqliteIndex(tmp_path)
    index.rebuild()
    watcher = FileWatcher(tmp_path, index, [push])
    alerts = run / "epoch_0000" / "alerts.jsonl"
    alerts.write_text(json.dumps({"step": 4, "wall_time": 1.0, "rank": 0, "rule": "non_finite", "path": "loss", "value": None, "message": "became nan"}) + "\n")

    asyncio.run(watcher.handle([str(alerts)]))
    server.shutdown()

    path, body, headers = next(entry for entry in PushService.received if entry[0] == "/live")
    payload = json.loads(http_ece.decrypt(body, private_key=private_key, auth_secret=auth, version="aes128gcm"))
    assert payload == {"title": "p.r", "body": "p.r: loss became nan at step 4", "url": "/p.r"}
    assert headers["Authorization"].startswith("vapid t=")
    assert [saved["endpoint"] for saved in json.loads((tmp_path / "push.json").read_text())["subscriptions"]] == [live["endpoint"]]


class RecordingTransport:
    def __init__(self):
        self.events = []

    async def push(self, event):
        self.events.append(event)


def test_a_silent_running_run_raises_one_heartbeat_event_until_it_logs_again(tmp_path, monkeypatch):
    run = tmp_path / "p" / "r"
    (run / "epoch_0000").mkdir(parents=True)
    (run / "meta.json").write_text(json.dumps({"status": "running", "samples_seen": 0, "start_wall_time": 0.0}))
    metrics = run / "epoch_0000" / "metrics.jsonl"
    metrics.write_text(json.dumps({"step": 3, "samples_seen": 0, "wall_time": 100.0, "rank": 0, "scalars": {"loss": 1.0}}) + "\n")
    index = SqliteIndex(tmp_path)
    index.rebuild()
    transport = RecordingTransport()
    watcher = FileWatcher(tmp_path, index, [transport])
    now = {"seconds": 100.0 + 600}
    monkeypatch.setattr("backend.domain.read_table.time.time", lambda: now["seconds"])

    asyncio.run(watcher.check_heartbeats())
    asyncio.run(watcher.check_heartbeats())
    metrics.write_text(metrics.read_text() + json.dumps({"step": 4, "samples_seen": 0, "wall_time": 700.0, "rank": 0, "scalars": {"loss": 1.0}}) + "\n")
    asyncio.run(watcher.check_heartbeats())
    now["seconds"] = 700.0 + 600
    asyncio.run(watcher.check_heartbeats())

    assert [event["text"] for event in transport.events] == [
        "p.r: run has logged nothing for 10 min at step 3",
        "p.r: run has logged nothing for 10 min at step 4",
    ]
