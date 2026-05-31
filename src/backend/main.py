from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import runs, tables, series, views, workspaces, ws

app = FastAPI()

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
