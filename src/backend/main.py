import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .adapters.file_watcher import FileWatcher
from .adapters.sqlite_index import SqliteIndex
from .adapters.web_push import WebPushTransport
from .adapters.websocket_transport import WebSocketTransport
from .api import projects, push, runs, series, tables, views, workspaces, ws
from .api.errors import ERROR_SOURCES, ApiError, api_error_response
from .config import get_runs_root


@asynccontextmanager
async def lifespan(app: FastAPI):
    runs_root = get_runs_root()
    index = SqliteIndex(runs_root)
    index.rebuild()
    transport = WebSocketTransport()
    push = WebPushTransport(runs_root)
    app.state.index = index
    app.state.transport = transport
    app.state.push = push
    watcher = FileWatcher(runs_root, index, [transport, push])
    tasks = [asyncio.create_task(watcher.run()), asyncio.create_task(watcher.watch_heartbeats())]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware)
for source in ERROR_SOURCES:
    app.add_exception_handler(source, api_error_response)

app.include_router(projects.router)
app.include_router(push.router)
app.include_router(runs.router)
app.include_router(tables.router)
app.include_router(series.router)
app.include_router(views.router)
app.include_router(workspaces.router)
app.include_router(ws.router)

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets", check_dir=False), name="assets")


@app.get("/design-system")
def serve_design_system() -> FileResponse:
    return FileResponse(FRONTEND_DIST / "design-system.html")


@app.get("/{page_path:path}")
def serve_frontend(page_path: str) -> FileResponse:
    if page_path.startswith("api/"):
        raise ApiError(404, "HTTP_404", f"no API route /{page_path}")
    file = (FRONTEND_DIST / page_path).resolve()
    return FileResponse(file if file.is_file() and FRONTEND_DIST in file.parents else FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
