from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..config import get_runs_root
from ..domain.models import CellType, Table
from ..domain.read_table import read_table
from ..domain.table_engine import ExpressionError, evaluate

router = APIRouter()


@router.get("/api/paths")
def list_paths(runs_root: Path = Depends(get_runs_root)) -> list[str]:
    out: list[str] = []

    def walk(path: str) -> None:
        try:
            table = read_table(path, runs_root)
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
    path: str = Query(...), runs_root: Path = Depends(get_runs_root)
) -> dict:
    try:
        table = read_table(path, runs_root)
        return _table_to_dict(table)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="TABLE_NOT_FOUND")


class EvalRequest(BaseModel):
    expression: str


@router.post("/api/tables/eval")
def eval_table(req: EvalRequest, runs_root: Path = Depends(get_runs_root)) -> dict:
    try:
        return _table_to_dict(evaluate(req.expression, runs_root))
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
