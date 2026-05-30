from pathlib import Path

from .models import Table


def evaluate(expression: str, runs_root: Path) -> Table:
    """Evaluate a table expression (stub for v0)."""
    raise NotImplementedError


def parse(expression: str):
    """Parse a table expression (stub for v0)."""
    raise NotImplementedError
