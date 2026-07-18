import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .adapters.file_watcher import FileWatcher
from .adapters.sqlite_index import SqliteIndex
from .adapters.websocket_transport import WebSocketTransport
from .api import runs, series, tables, views, workspaces, ws
from .config import get_runs_root


@asynccontextmanager
async def lifespan(app: FastAPI):
    runs_root = get_runs_root()
    index = SqliteIndex(runs_root)
    index.rebuild()
    transport = WebSocketTransport()
    app.state.index = index
    app.state.transport = transport
    watcher = asyncio.create_task(FileWatcher(runs_root, index, transport).run())
    yield
    watcher.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router)
app.include_router(tables.router)
app.include_router(series.router)
app.include_router(views.router)
app.include_router(workspaces.router)
app.include_router(ws.router)

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{page_path:path}")
def serve_frontend(page_path: str) -> FileResponse:
    return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
