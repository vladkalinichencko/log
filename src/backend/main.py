from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api import runs, tables, series, views, workspaces, ws
from .config import get_runs_root

app = FastAPI()

# CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency injection for runs_root
@app.middleware("http")
async def inject_runs_root(request: Request, call_next):
    """Inject runs_root into route handlers."""
    request.state.runs_root = get_runs_root()
    response = await call_next(request)
    return response


# Register routers
app.include_router(runs.router)
app.include_router(tables.router)
app.include_router(series.router)
app.include_router(views.router)
app.include_router(workspaces.router)
app.include_router(ws.router)


# Override route handlers to inject runs_root from request.state
from .api.tables import get_table as _get_table_orig
from .api.runs import get_runs as _get_runs_orig


@app.get("/api/table")
def get_table_with_root(path: str, request: Request):
    return _get_table_orig(path, request.state.runs_root)


@app.get("/api/runs")
def get_runs_with_root(request: Request):
    return _get_runs_orig(request.state.runs_root)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
