from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..config import get_engine, get_storage
from ..domain.compare_runs import compare_runs
from ..domain.models import CellType, Table
from ..domain.read_table import read_table
from ..domain.table_engine import ExpressionError
from ..ports.storage_port import StoragePort
from ..ports.table_engine_port import TableEnginePort
from .errors import ApiError

router = APIRouter()


class EvalRequest(BaseModel):
    expression: str


class CompareRunsRequest(BaseModel):
    runs: list[str]


@router.get("/api/tables/functions")
def list_functions(engine: TableEnginePort = Depends(get_engine)) -> list[dict]:
    return engine.functions()


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
def eval_table(req: EvalRequest, storage: StoragePort = Depends(get_storage), engine: TableEnginePort = Depends(get_engine)) -> Table:
    try:
        return engine.evaluate(req.expression, storage)
    except ExpressionError as error:
        raise ApiError(400, "TABLE_EXPRESSION_ERROR", str(error))


@router.post("/api/runs/compare")
def compare_run_tables(req: CompareRunsRequest, storage: StoragePort = Depends(get_storage)) -> Table:
    try:
        return compare_runs(req.runs, storage)
    except (FileNotFoundError, ValueError) as error:
        raise ApiError(400, "RUN_COMPARISON_ERROR", str(error))
