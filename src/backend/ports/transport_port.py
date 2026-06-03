from typing import Protocol


class TransportPort(Protocol):

    async def push(self, event: dict) -> None:
        ...
