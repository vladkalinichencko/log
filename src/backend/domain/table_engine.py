import operator
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

import numpy as np

from .models import Cell, CellType, Representation, Table, TableKind
from .read_table import read_table

Column = list[float]


@dataclass
class Function:
    kind: Literal["aggregation", "transform"]
    fn: Callable[..., float | Column]


def _rolling_mean(col: Column, window: int) -> Column:
    a = np.asarray(col, dtype=float)
    return [float(a[max(0, i - window + 1) : i + 1].mean()) for i in range(len(a))]


def _zscore(col: Column, window: int) -> Column:
    a = np.asarray(col, dtype=float)
    out: Column = []
    for i in range(len(a)):
        w = a[max(0, i - window + 1) : i + 1]
        sd = float(w.std())
        out.append(float((a[i] - w.mean()) / sd) if sd else 0.0)
    return out


FUNCTIONS: dict[str, Function] = {
    "mean": Function("aggregation", lambda col: float(np.mean(col))),
    "sum": Function("aggregation", lambda col: float(np.sum(col))),
    "min": Function("aggregation", lambda col: float(np.min(col))),
    "max": Function("aggregation", lambda col: float(np.max(col))),
    "count": Function("aggregation", lambda col: float(len(col))),
    "std": Function("aggregation", lambda col: float(np.std(col))),
    "rolling_mean": Function("transform", _rolling_mean),
    "zscore": Function("transform", _zscore),
    "abs": Function("transform", lambda col: np.abs(col).tolist()),
    "log": Function("transform", lambda col: np.log(col).tolist()),
    "sqrt": Function("transform", lambda col: np.sqrt(col).tolist()),
}

_CMP = {
    "==": operator.eq, "!=": operator.ne, ">": operator.gt,
    ">=": operator.ge, "<": operator.lt, "<=": operator.le,
}


class ExpressionError(ValueError):
    pass


def _value(text: str):
    text = text.strip()
    try:
        return float(text)
    except ValueError:
        return text


def parse(expression: str) -> dict:
    stages = [s.strip() for s in _split_top(expression, "|")]
    source = stages[0]
    match = re.fullmatch(r"table\((.+)\)", source)
    if not match:
        raise ExpressionError(f"expression must start with table(...): {source!r}")
    ops = []
    for stage in stages[1:]:
        op = re.fullmatch(r"(\w+)\((.*)\)", stage)
        if not op:
            raise ExpressionError(f"bad operator: {stage!r}")
        ops.append((op.group(1), op.group(2)))
    return {"path": match.group(1).strip(), "ops": ops}


def _split_top(text: str, sep: str) -> list[str]:
    parts, depth, current = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    parts.append(current)
    return parts


def evaluate(expression: str, runs_root: Path) -> Table:
    ast = parse(expression)
    names, rows = _read_columns(ast["path"], runs_root)
    for name, args in ast["ops"]:
        names, rows = _apply(name, args, names, rows, runs_root)
    return _to_table(names, rows)


def _read_columns(path: str, runs_root: Path):
    try:
        table = read_table(path, runs_root)
    except FileNotFoundError as e:
        raise ExpressionError(str(e)) from e
    names = table.column_names or [f"c{i}" for i in range(len(table.cells[0]) if table.cells else 0)]
    rows = [[_value(cell.value) for cell in row] for row in table.cells]
    return names, rows


def _col(names, rows, name):
    if name not in names:
        raise ExpressionError(f"no column {name!r}")
    i = names.index(name)
    return [r[i] for r in rows]


def _apply(op, args, names, rows, runs_root):
    if op == "select":
        keep = [a.strip() for a in args.split(",")]
        idx = [names.index(k) if k in names else _missing(k) for k in keep]
        return keep, [[r[i] for i in idx] for r in rows]

    if op == "filter":
        m = re.fullmatch(r"\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)", args)
        if not m:
            raise ExpressionError(f"bad filter: {args!r}")
        i = names.index(m.group(1)) if m.group(1) in names else _missing(m.group(1))
        cmp, val = _CMP[m.group(2)], _value(m.group(3))
        return names, [r for r in rows if cmp(r[i], val)]

    if op == "sort":
        m = re.fullmatch(r"\s*(\w+)\s*,?\s*(asc|desc)?\s*", args)
        i = names.index(m.group(1)) if m and m.group(1) in names else _missing(args)
        return names, sorted(rows, key=lambda r: r[i], reverse=(m.group(2) == "desc"))

    if op == "derive":
        name, _, call = args.partition("=")
        fname, fargs = _parse_call(call)
        func = _function(fname, "transform")
        column = _col(names, rows, fargs[0])
        derived = func.fn(column, *[int(a) for a in fargs[1:]])
        return names + [name.strip()], [r + [derived[i]] for i, r in enumerate(rows)]

    if op == "agg":
        m = re.fullmatch(r"\s*(\w+)\s*,\s*by=(\w+)\s*", args)
        if not m:
            raise ExpressionError(f"bad agg: {args!r}")
        func = _function(m.group(1), "aggregation")
        by = m.group(2)
        bi = names.index(by) if by in names else _missing(by)
        others = [n for n in names if n != by]
        groups: dict = {}
        for r in rows:
            groups.setdefault(r[bi], []).append(r)
        out_names = [by] + others
        out_rows = [
            [key] + [func.fn(_col(names, grp, n)) for n in others]
            for key, grp in groups.items()
        ]
        return out_names, out_rows

    if op in ("join", "concat"):
        sub = re.fullmatch(r"\s*table\((.+?)\)\s*(?:,\s*on=(\w+))?\s*", args)
        if not sub:
            raise ExpressionError(f"bad {op}: {args!r}")
        names2, rows2 = _read_columns(sub.group(1).strip(), runs_root)
        if op == "join":
            return _join(names, rows, names2, rows2, sub.group(2))
        return _concat(names, rows, names2, rows2)

    raise ExpressionError(f"unknown operator {op!r}")


def _missing(name):
    raise ExpressionError(f"no column {name!r}")


def _parse_call(text):
    m = re.fullmatch(r"\s*(\w+)\((.*)\)\s*", text.strip())
    if not m:
        raise ExpressionError(f"bad function call: {text!r}")
    return m.group(1), [a.strip() for a in m.group(2).split(",")]


def _function(name, kind):
    fn = FUNCTIONS.get(name)
    if fn is None or fn.kind != kind:
        raise ExpressionError(f"no {kind} function {name!r}")
    return fn


def _join(names, rows, names2, rows2, on):
    if on not in names or on not in names2:
        raise ExpressionError(f"join column {on!r} missing")
    i1, i2 = names.index(on), names2.index(on)
    extra = [(n, j) for j, n in enumerate(names2) if j != i2]
    index2 = {}
    for r in rows2:
        index2.setdefault(r[i2], r)
    out_names = names + [f"{n}_2" if n in names else n for n, _ in extra]
    out_rows = [r + [index2[r[i1]][j] for _, j in extra] for r in rows if r[i1] in index2]
    return out_names, out_rows


def _concat(names, rows, names2, rows2):
    if names != names2:
        raise ExpressionError("concat needs matching columns")
    combined = rows + rows2
    step_i = names.index("step") if "step" in names else None
    continuity = []
    for k, r in enumerate(combined):
        if step_i is None or k == 0:
            continuity.append(True)
        else:
            continuity.append(combined[k][step_i] >= combined[k - 1][step_i])
    return names + ["continuity"], [r + [continuity[k]] for k, r in enumerate(combined)]


def _to_table(names, rows) -> Table:
    cells = [
        [
            Cell(
                type=CellType.number if isinstance(v, (int, float)) and not isinstance(v, bool) else (CellType.bool if isinstance(v, bool) else CellType.string),
                value=str(v),
                ref=None,
            )
            for v in row
        ]
        for row in rows
    ]
    return Table(
        name="result",
        kind=TableKind.column,
        column_names=names,
        row_names=None,
        cells=cells,
        representation=Representation.grid,
        source_path=None,
    )
