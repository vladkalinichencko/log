from typing import Protocol

from ..domain.models import RunSummary


class IndexPort(Protocol):

    def query(self, project: str | None, status: str | None, tag: str | None) -> list[RunSummary]:
        ...

    def upsert(self, run: RunSummary) -> None:
        ...

    def rebuild(self) -> None:
        ...
