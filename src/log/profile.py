import time
from contextlib import contextmanager

import torch
from torch.profiler import ProfilerActivity

from .run import get_active_run
from .writer.queue_writer import RowJob, TraceJob


@contextmanager
def phase(name: str):
    ctx = get_active_run()
    parent = ctx.phases[-1] if ctx.phases else ""
    step, epoch, start = ctx.current_step, ctx.epoch, time.time()
    ctx.phases.append(name)
    try:
        yield
    finally:
        ctx.phases.pop()
        span = {"step": step, "rank": 0, "name": name, "parent": parent, "start": start, "end": time.time()}
        ctx.writer.enqueue(RowJob(file="spans.jsonl", row=span, epoch=epoch))


@contextmanager
def profile(every: int = 1000):
    ctx = get_active_run()
    ctx.profiled_blocks += 1
    if (ctx.profiled_blocks - 1) % every:
        yield
        return
    activities = [ProfilerActivity.CPU, *([ProfilerActivity.CUDA] if torch.cuda.is_available() else [])]
    with torch.profiler.profile(activities=activities) as profiler:
        yield
    ctx.writer.enqueue(TraceJob(profiler=profiler, step=ctx.current_step, epoch=ctx.epoch))
