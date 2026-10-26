from typing import Protocol

from ..domain.models import Table
from .storage_port import StoragePort


class TableEnginePort(Protocol):

    def evaluate(self, expression: str, storage: StoragePort) -> Table:
        ...

    def functions(self) -> list[dict]:
        ...
