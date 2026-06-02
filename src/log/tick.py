from .logger import log
from .run import get_active_run


def tick(samples: int | None = None, **scalars: float) -> None:
    ctx = get_active_run()
    if samples is not None:
        ctx.samples_seen += samples
    for name, value in scalars.items():
        log(name, value)
