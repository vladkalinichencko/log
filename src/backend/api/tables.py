import inspect

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..config import get_storage
from ..domain.compare_runs import compare_runs
from ..domain.models import CellType, Table
from ..domain.read_table import read_table
from ..domain.table_engine import FUNCTIONS, ExpressionError, evaluate
from ..ports.storage_port import StoragePort
from .errors import ApiError

router = APIRouter()


class EvalRequest(BaseModel):
    expression: str


class CompareRunsRequest(BaseModel):
    runs: list[str]


@router.get("/api/tables/functions")
def list_functions() -> list[dict]:
    return [
        {"name": name, "kind": fn.kind, "windowed": len(inspect.signature(fn.fn).parameters) > 1}
        for name, fn in FUNCTIONS.items()
    ]


@router.get("/api/paths")
def list_paths(storage: StoragePort = Depends(get_storage)) -> list[str]:
    paths: list[str] = []

    def walk(path: str) -> None:
        try:
            table = read_table(path, storage)
        except FileNotFoundError:
            return
        for row in table.cells:
            for cell in row:
                if cell.type == CellType.table_ref and cell.ref:
                    paths.append(cell.ref)
                    walk(cell.ref)

    walk("")
    return paths


@router.get("/api/table")
def get_table(path: str = Query(...), storage: StoragePort = Depends(get_storage)) -> Table:
    try:
        return read_table(path, storage)
    except FileNotFoundError as error:
        raise ApiError(404, "TABLE_NOT_FOUND", str(error))


@router.post("/api/tables/eval")
def eval_table(req: EvalRequest, storage: StoragePort = Depends(get_storage)) -> Table:
    try:
        return evaluate(req.expression, storage)
    except ExpressionError as error:
        raise ApiError(400, "TABLE_EXPRESSION_ERROR", str(error))


@router.post("/api/runs/compare")
def compare_run_tables(req: CompareRunsRequest, storage: StoragePort = Depends(get_storage)) -> Table:
    try:
        return compare_runs(req.runs, storage)
    except (FileNotFoundError, ValueError) as error:
        raise ApiError(400, "RUN_COMPARISON_ERROR", str(error))
