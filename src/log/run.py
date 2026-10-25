import inspect
import json
import time
from functools import wraps
from pathlib import Path
from typing import Any, Callable, TypeVar

from .errors import ConfigSerializationError, InvalidStepUnitError, NoActiveRunError, RunDirectoryError
from .writer.atomic import atomic_write_bytes, update_json
from .writer.identity import git_hash, requirements_hash
from .writer.layout import resolve_run_dir
from .writer.queue_writer import WriterThread

T = TypeVar("T")

_active_run: "RunContext | None" = None


class RunContext:
    def __init__(
        self,
        run_dir: Path,
        config: dict,
        step_unit: str,
        writer: WriterThread,
    ):
        self.run_dir = run_dir
        self.config = config
        self.step_unit = step_unit
        self.writer = writer
        self.samples_seen = 0
        self.epoch = 0
        self.current_step = 0
        self.watch_handles: list = []


class Config:
    def __init__(self, params: dict):
        self._params = params

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        return self._params.get(name)


def run(
    project: str = "default",
    name: str | None = None,
    config: dict | None = None,
    tags: list[str] | None = None,
    step_unit: str = "samples_seen",
    runs_root: str | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    if config is None:
        config = {}
    if tags is None:
        tags = []

    allowed_step_units = {"samples_seen", "batch", "sample", "generation", "episode"}
    if step_unit not in allowed_step_units:
        raise InvalidStepUnitError(
            f"step_unit must be one of {allowed_step_units}, got {step_unit!r}"
        )

    try:
        json.dumps(config)
    except (TypeError, ValueError) as e:
        raise ConfigSerializationError(
            f"config must be JSON-serializable: {e}"
        ) from e

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            global _active_run

            try:
                run_dir = resolve_run_dir(project, name, runs_root)
                run_dir.mkdir(parents=True, exist_ok=False)
            except Exception as e:
                raise RunDirectoryError(f"Cannot create run directory: {e}") from e

            config_json = {
                "params": config,
                "step_unit": step_unit,
            }
            config_path = run_dir / "config.json"
            atomic_write_bytes(config_path, json.dumps(config_json, indent=2).encode())

            meta_json = {
                "git_hash": git_hash(),
                "requirements_hash": requirements_hash(),
                "start_wall_time": time.time(),
                "samples_seen": 0,
                "world_size": 1,
                "status": "running",
                "tags": tags,
                "resume_diff": None,
                "writer_errors": [],
            }
            meta_path = run_dir / "meta.json"
            atomic_write_bytes(meta_path, json.dumps(meta_json, indent=2).encode())

            writer = WriterThread(run_dir, meta_path)
            writer.start()
            _active_run = RunContext(run_dir, config, step_unit, writer)

            status = "finished"
            try:
                takes_config = len(inspect.signature(fn).parameters) >= 1
                if takes_config:
                    return fn(Config(config), *args, **kwargs)
                return fn(*args, **kwargs)
            except Exception:
                status = "crashed"
                raise
            finally:
                for handle in _active_run.watch_handles:
                    handle.remove()
                writer.stop_and_join()
                update_json(meta_path, {"status": status, "samples_seen": _active_run.samples_seen, "end_wall_time": time.time()})
                _active_run = None

        return wrapper

    return decorator


def get_active_run() -> RunContext:
    if _active_run is None:
        raise NoActiveRunError("No active run; wrap your code in @log.run")
    return _active_run
