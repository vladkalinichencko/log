import operator
import re
from dataclasses import dataclass
from typing import Callable, Literal

import numpy as np

from ..ports.storage_port import StoragePort
from .models import Cell, CellType, Table, TableKind
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
    "median": Function("aggregation", lambda col: float(np.median(col))),
    "var": Function("aggregation", lambda col: float(np.var(col))),
    "norm": Function("aggregation", lambda col: float(np.linalg.norm(col))),
    "rolling_mean": Function("transform", _rolling_mean),
    "zscore": Function("transform", _zscore),
    "abs": Function("transform", lambda col: np.abs(col).tolist()),
    "log": Function("transform", lambda col: np.log(col).tolist()),
    "sqrt": Function("transform", lambda col: np.sqrt(col).tolist()),
    "cumsum": Function("transform", lambda col: np.cumsum(col).tolist()),
    "diff": Function("transform", lambda col: np.diff(col, prepend=col[0]).tolist()),
}

_COMPARE = {
    "==": operator.eq, "!=": operator.ne, ">": operator.gt,
    ">=": operator.ge, "<": operator.lt, "<=": operator.le,
}
_ARITH = {"+": np.add, "-": np.subtract, "*": np.multiply, "/": np.divide}


class ExpressionError(ValueError):
    pass


_TOKEN = re.compile(r"==|!=|>=|<=|[()|,=<>+\-*/]|[\w.]+")
_WORD = re.compile(r"[\w.]+")


def tokenize(text: str) -> list[str]:
    tokens, pos = [], 0
    while pos < len(text):
        if text[pos].isspace():
            pos += 1
            continue
        match = _TOKEN.match(text, pos)
        if not match:
            raise ExpressionError(f"bad token near {text[pos:]!r}")
        tokens.append(match.group())
        pos = match.end()
    return tokens


class Stream:
    def __init__(self, tokens: list[str]):
        self.tokens = tokens
        self.pos = 0

    def peek(self, ahead: int = 0) -> str:
        i = self.pos + ahead
        return self.tokens[i] if i < len(self.tokens) else ""

    def take(self) -> str:
        token = self.peek()
        if not token:
            raise ExpressionError("unexpected end of expression")
        self.pos += 1
        return token

    def expect(self, text: str) -> str:
        if self.peek() != text:
            raise ExpressionError(f"expected {text!r}, got {self.peek()!r}")
        return self.take()

    def word(self) -> str:
        if not _WORD.fullmatch(self.peek()):
            raise ExpressionError(f"expected a name, got {self.peek()!r}")
        return self.take()

    def done(self) -> bool:
        return self.pos >= len(self.tokens)


def parse(expression: str) -> tuple:
    stream = Stream(tokenize(expression))
    node = _pipeline(stream)
    if not stream.done():
        raise ExpressionError(f"trailing tokens: {stream.tokens[stream.pos:]!r}")
    return node


def _pipeline(stream: Stream) -> tuple:
    source = _source(stream)
    stages = []
    while stream.peek() == "|":
        stream.take()
        stages.append(_stage(stream))
    return ("pipe", source, stages)


def _source(stream: Stream) -> tuple:
    stream.expect("table")
    stream.expect("(")
    arg = _pipeline(stream) if stream.peek() == "table" and stream.peek(1) == "(" else stream.word()
    stream.expect(")")
    return ("table", arg)


def _stage(stream: Stream) -> tuple:
    op = stream.word()
    if op not in STAGE_PARSERS:
        raise ExpressionError(f"unknown operator {op!r}")
    stream.expect("(")
    payload = STAGE_PARSERS[op](stream)
    stream.expect(")")
    return (op, payload)


def _parse_select(stream: Stream) -> list[str]:
    cols = [stream.word()]
    while stream.peek() == ",":
        stream.take()
        cols.append(stream.word())
    return cols


def _parse_filter(stream: Stream) -> tuple:
    col = stream.word()
    comparator = stream.take()
    if comparator not in _COMPARE:
        raise ExpressionError(f"bad comparator {comparator!r}")
    return (col, comparator, _value(stream.word()))


def _parse_sort(stream: Stream) -> tuple:
    col = stream.word()
    descending = False
    if stream.peek() == ",":
        stream.take()
        descending = stream.word() == "desc"
    return (col, descending)


def _parse_derive(stream: Stream) -> tuple:
    name = stream.word()
    stream.expect("=")
    return (name, _expr(stream))


def _parse_agg(stream: Stream) -> tuple:
    func = stream.word()
    stream.expect(",")
    stream.expect("by")
    stream.expect("=")
    return (func, stream.word())


def _parse_join(stream: Stream) -> tuple:
    right = _pipeline(stream)
    stream.expect(",")
    stream.expect("on")
    stream.expect("=")
    return (right, stream.word())


def _parse_concat(stream: Stream) -> tuple:
    return (_pipeline(stream),)


STAGE_PARSERS: dict[str, Callable[[Stream], object]] = {
    "select": _parse_select,
    "filter": _parse_filter,
    "sort": _parse_sort,
    "derive": _parse_derive,
    "agg": _parse_agg,
    "join": _parse_join,
    "concat": _parse_concat,
}


def _expr(stream: Stream) -> tuple:
    return _add(stream)


def _add(stream: Stream) -> tuple:
    node = _mul(stream)
    while stream.peek() in ("+", "-"):
        node = ("bin", stream.take(), node, _mul(stream))
    return node


def _mul(stream: Stream) -> tuple:
    node = _unary(stream)
    while stream.peek() in ("*", "/"):
        node = ("bin", stream.take(), node, _unary(stream))
    return node


def _unary(stream: Stream) -> tuple:
    if stream.peek() == "-":
        stream.take()
        return ("neg", _unary(stream))
    return _atom(stream)


def _atom(stream: Stream) -> tuple:
    if stream.peek() == "(":
        stream.take()
        node = _expr(stream)
        stream.expect(")")
        return node
    word = stream.word()
    if stream.peek() == "(":
        stream.take()
        args = [_expr(stream)]
        while stream.peek() == ",":
            stream.take()
            args.append(_expr(stream))
        stream.expect(")")
        return ("call", word, args)
    value = _value(word)
    return ("num", value) if isinstance(value, float) else ("col", word)


def evaluate(expression: str, storage: StoragePort) -> Table:
    names, rows = _eval_pipeline(parse(expression), storage)
    return _to_table(names, rows)


def _eval_pipeline(node: tuple, storage: StoragePort):
    _, source, stages = node
    names, rows = _eval_source(source, storage)
    for op, payload in stages:
        names, rows = STAGE_EVAL[op](payload, names, rows, storage)
    return names, rows


def _eval_source(source: tuple, storage: StoragePort):
    arg = source[1]
    if isinstance(arg, tuple):
        return _eval_pipeline(arg, storage)
    return _read_columns(arg, storage)


def _value(text: str):
    try:
        return float(text)
    except ValueError:
        return text


def _read_columns(path: str, storage: StoragePort):
    try:
        table = read_table(path, storage)
    except FileNotFoundError as e:
        raise ExpressionError(str(e)) from e
    names = table.column_names or [f"c{i}" for i in range(len(table.cells[0]) if table.cells else 0)]
    rows = [[_value(cell.value) for cell in row] for row in table.cells]
    return names, rows


def _index(names, name):
    if name not in names:
        raise ExpressionError(f"no column {name!r}")
    return names.index(name)


def _col(names, rows, name):
    i = _index(names, name)
    return [r[i] for r in rows]


def _function(name, kind):
    fn = FUNCTIONS.get(name)
    if fn is None or fn.kind != kind:
        raise ExpressionError(f"no {kind} function {name!r}")
    return fn


def _eval_select(cols, names, rows, _):
    idx = [_index(names, c) for c in cols]
    return cols, [[r[i] for i in idx] for r in rows]


def _eval_filter(payload, names, rows, _):
    col, comparator, value = payload
    i = _index(names, col)
    keep = _COMPARE[comparator]
    return names, [r for r in rows if keep(r[i], value)]


def _eval_sort(payload, names, rows, _):
    col, descending = payload
    i = _index(names, col)
    return names, sorted(rows, key=lambda r: r[i], reverse=descending)


def _eval_derive(payload, names, rows, _):
    name, expr = payload
    column = _eval_expr(expr, names, rows)
    return names + [name], [r + [column[k]] for k, r in enumerate(rows)]


def _eval_agg(payload, names, rows, _):
    func_name, by = payload
    func = _function(func_name, "aggregation")
    bi = _index(names, by)
    others = [n for n in names if n != by]
    groups: dict = {}
    for r in rows:
        groups.setdefault(r[bi], []).append(r)
    out_rows = [
        [key] + [func.fn(_col(names, grp, n)) for n in others]
        for key, grp in groups.items()
    ]
    return [by] + others, out_rows


def _eval_join(payload, names, rows, storage):
    right, on = payload
    names2, rows2 = _eval_pipeline(right, storage)
    return _join(names, rows, names2, rows2, on)


def _eval_concat(payload, names, rows, storage):
    names2, rows2 = _eval_pipeline(payload[0], storage)
    return _concat(names, rows, names2, rows2)


STAGE_EVAL: dict[str, Callable[..., tuple]] = {
    "select": _eval_select,
    "filter": _eval_filter,
    "sort": _eval_sort,
    "derive": _eval_derive,
    "agg": _eval_agg,
    "join": _eval_join,
    "concat": _eval_concat,
}


def _eval_expr(node, names, rows) -> Column:
    return EXPR_EVAL[node[0]](node, names, rows)


def _eval_num(node, names, rows):
    return [node[1]] * len(rows)


def _eval_ref(node, names, rows):
    return _col(names, rows, node[1])


def _eval_neg(node, names, rows):
    return [-v for v in _eval_expr(node[1], names, rows)]


def _eval_bin(node, names, rows):
    _, op, left, right = node
    a = np.asarray(_eval_expr(left, names, rows), dtype=float)
    b = np.asarray(_eval_expr(right, names, rows), dtype=float)
    return _ARITH[op](a, b).tolist()


def _eval_call(node, names, rows):
    _, name, args = node
    func = FUNCTIONS.get(name)
    if func is None:
        raise ExpressionError(f"no function {name!r}")
    column = _eval_expr(args[0], names, rows)
    extra = [int(_eval_expr(a, names, rows)[0]) for a in args[1:]]
    result = func.fn(column, *extra)
    return [result] * len(rows) if func.kind == "aggregation" else result


EXPR_EVAL: dict[str, Callable[..., Column]] = {
    "num": _eval_num,
    "col": _eval_ref,
    "neg": _eval_neg,
    "bin": _eval_bin,
    "call": _eval_call,
}


def _join(names, rows, names2, rows2, on):
    i1, i2 = _index(names, on), _index(names2, on)
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
    return Table(
        name="result",
        kind=TableKind.column,
        column_names=names,
        cells=[[Cell(_cell_type(value), str(value)) for value in row] for row in rows],
        source_path=None,
    )


def _cell_type(value) -> CellType:
    if isinstance(value, bool):
        return CellType.bool
    if isinstance(value, (int, float)):
        return CellType.number
    return CellType.string
