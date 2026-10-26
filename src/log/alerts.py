import math
import statistics
from collections import deque
from typing import Callable

WINDOW = 100
WARMUP = 20
SPIKE_SIGMAS = 4
STALL_FACTOR = 10

Check = Callable[[list[float]], str | None]
Action = Callable[[dict], None]


def non_finite(history: list[float]) -> str | None:
    return None if math.isfinite(history[-1]) else f"became {history[-1]}"


def spike(history: list[float]) -> str | None:
    recent = [value for value in history[:-1] if math.isfinite(value)]
    if len(recent) < WARMUP or not math.isfinite(history[-1]):
        return None
    spread = statistics.pstdev(recent)
    sigmas = (history[-1] - statistics.fmean(recent)) / spread if spread else 0
    return f"is {sigmas:+.1f} standard deviations from its last {len(recent)} values" if abs(sigmas) > SPIKE_SIGMAS else None


def stall(gaps: list[float]) -> str | None:
    if len(gaps) <= WARMUP:
        return None
    usual = statistics.median(gaps[:-1])
    return f"took {gaps[-1]:.1f} s, {gaps[-1] / usual:.0f}× the usual {usual:.2f} s" if usual and gaps[-1] > STALL_FACTOR * usual else None


METRIC_RULES = {"non_finite": non_finite, "spike": spike}
STEP_RULES = {"stall": stall}


class Alerts:
    def __init__(self, enabled: dict[str, bool]):
        self.metric_rules = {rule: check for rule, check in METRIC_RULES.items() if enabled[rule]}
        self.step_rules = {rule: check for rule, check in STEP_RULES.items() if enabled[rule]}
        self.checks: dict[str, dict[str, Check]] = {}
        self.actions: list[Action] = []
        self.histories: dict[str, deque] = {}
        self.step_gaps: deque = deque(maxlen=WINDOW)
        self.step_start: tuple[int, int, float] | None = None
        self.firing: set[tuple[str, str]] = set()

    def observe(self, path: str, value: float, stamp: dict) -> list[dict]:
        rows = []
        moment = (stamp["epoch"], stamp["step"])
        if self.step_start is None or self.step_start[:2] != moment:
            if self.step_start is not None and self.step_start[0] == stamp["epoch"]:
                self.step_gaps.append(stamp["wall_time"] - self.step_start[2])
                rows += self._evaluate("step", list(self.step_gaps), self.step_rules, stamp)
            self.step_start = (*moment, stamp["wall_time"])
        history = self.histories.setdefault(path, deque(maxlen=WINDOW))
        history.append(value)
        return rows + self._evaluate(path, list(history), {**self.metric_rules, **self.checks.get(path, {})}, stamp)

    def _evaluate(self, path: str, history: list[float], rules: dict[str, Check], stamp: dict) -> list[dict]:
        rows = []
        for rule, check in rules.items():
            message = check(history)
            if message is None:
                self.firing.discard((rule, path))
            elif (rule, path) not in self.firing:
                self.firing.add((rule, path))
                rows.append({"step": stamp["step"], "wall_time": stamp["wall_time"], "rank": stamp["rank"], "rule": rule, "path": path, "value": history[-1], "message": message})
        return rows
