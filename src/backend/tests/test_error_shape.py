import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.mark.parametrize("method, url, body, status, code", [
    ("get", "/api/table?path=missing.run", None, 404, "TABLE_NOT_FOUND"),
    ("get", "/api/table", None, 422, "INVALID_REQUEST"),
    ("post", "/api/tables/eval", "not json", 422, "INVALID_REQUEST"),
    ("put", "/api/tables/eval", None, 405, "HTTP_405"),
    ("get", "/api/no-such-route", None, 404, "HTTP_404"),
])
def test_every_error_source_answers_in_the_documented_shape(tmp_path, monkeypatch, method, url, body, status, code):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    with TestClient(app) as client:
        response = client.request(method, url, content=body, headers={"content-type": "application/json"})
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


def test_an_unexpected_crash_still_answers_in_the_documented_shape(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    monkeypatch.setattr("backend.api.tables.read_table", lambda path, storage: 1 / 0)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/table", params={"path": "p"})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
