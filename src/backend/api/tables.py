import inspect

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..config import get_storage
from ..domain.models import CellType, Table
from ..domain.read_table import read_table
from ..domain.table_engine import FUNCTIONS, ExpressionError, evaluate
from ..ports.storage_port import StoragePort

router = APIRouter()


@router.get("/api/tables/functions")
def list_functions() -> list[dict]:
    return [
        {
            "name": name,
            "kind": fn.kind,
            "windowed": len(inspect.signature(fn.fn).parameters) > 1,
        }
        for name, fn in FUNCTIONS.items()
    ]


@router.get("/api/paths")
def list_paths(storage: StoragePort = Depends(get_storage)) -> list[str]:
    out: list[str] = []

    def walk(path: str) -> None:
        try:
            table = read_table(path, storage)
        except FileNotFoundError:
            return
        for row in table.cells:
            for cell in row:
                if cell.type == CellType.table_ref and cell.ref:
                    out.append(cell.ref)
                    walk(cell.ref)

    walk("")
    return out


@router.get("/api/table")
def get_table(
    path: str = Query(...), storage: StoragePort = Depends(get_storage)
) -> dict:
    try:
        table = read_table(path, storage)
        return _table_to_dict(table)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="TABLE_NOT_FOUND")


class EvalRequest(BaseModel):
    expression: str


@router.post("/api/tables/eval")
def eval_table(req: EvalRequest, storage: StoragePort = Depends(get_storage)) -> dict:
    try:
        return _table_to_dict(evaluate(req.expression, storage))
    except ExpressionError:
        raise HTTPException(status_code=400, detail="TABLE_EXPRESSION_ERROR")


def _table_to_dict(table: Table) -> dict:
    return {
        "name": table.name,
        "kind": table.kind.value,
        "column_names": table.column_names,
        "row_names": table.row_names,
        "cells": [
            [{"type": c.type.value, "value": c.value, "ref": c.ref} for c in row]
            for row in table.cells
        ],
        "representation": table.representation.value,
        "source_path": table.source_path,
    }
