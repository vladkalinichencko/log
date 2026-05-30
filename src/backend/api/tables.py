from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from ..domain.models import Table
from ..domain.read_table import read_table

router = APIRouter()


@router.get("/api/table")
def get_table(path: str = Query(...), runs_root: Path = None) -> dict:
    """Get a table by dot-path."""
    try:
        table = read_table(path, runs_root)
        return _table_to_dict(table)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="TABLE_NOT_FOUND")


def _table_to_dict(table: Table) -> dict:
    """Convert Table to dict for JSON response."""
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
