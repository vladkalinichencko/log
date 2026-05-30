"""The one function registry behind the formula language (§9.13).

Every name usable in `agg(...)` and `derive(...)` lives in `FUNCTIONS`. Each entry
has the identical shape and differs only by name, kind, and body (Lego):
- kind "aggregation": column -> scalar (a derived row), e.g. mean, std
- kind "transform":   column -> column (a derived column), e.g. rolling_mean
Adding a statistic = adding one `FUNCTIONS` entry; nothing else changes.
"""
from dataclasses import dataclass
from typing import Callable, Literal

import numpy as np

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
