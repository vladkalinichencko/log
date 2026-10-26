import itertools
import json
import sys
from types import SimpleNamespace

import pytest
import torch
from torch.utils.data import DataLoader, TensorDataset

import log


def _rundir(tmp_path, project="p"):
    return next((tmp_path / project).iterdir())


def test_warmup_cosine_factors():
    model = torch.nn.Linear(2, 2)
    opt = torch.optim.SGD(model.parameters(), lr=1.0)
    sched = log.warmup_cosine(opt, warmup=10, total=110)
    assert abs(opt.param_groups[0]["lr"] - 0.1) < 1e-6
    for _ in range(9):
        sched.step()
    assert abs(opt.param_groups[0]["lr"] - 1.0) < 1e-6
    for _ in range(101):
        sched.step()
    assert abs(opt.param_groups[0]["lr"] - 0.0) < 1e-6


def test_tick_advances_samples_and_no_checkpoint(tmp_path):
    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        log.tick(samples=8, loss=1.2)

    main()
    rundir = _rundir(tmp_path)
    row = json.loads((rundir / "epoch_0000" / "metrics.jsonl").read_text().splitlines()[0])
    assert row["scalars"]["loss"] == 1.2
    assert row["samples_seen"] == 8
    assert not (rundir / "checkpoints").exists()


def test_track_counts_samples(tmp_path):
    captured = {}
    dataset = TensorDataset(torch.zeros(80, 3))

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        for _ in log.track(DataLoader(dataset, batch_size=8)):
            pass
        captured["seen"] = log.run.__globals__["_active_run"].samples_seen

    main()
    assert captured["seen"] == 80


def test_distribute_identity_single_rank():
    net = torch.nn.Linear(2, 2)
    assert log.distribute(net) is net


def test_watch_logs_module_activations(tmp_path):
    net = torch.nn.Sequential(torch.nn.Linear(4, 4), torch.nn.ReLU(), torch.nn.Linear(4, 2))

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        handle = log.watch(net)
        net(torch.randn(1, 4))
        handle.remove()

    main()
    index = _rundir(tmp_path) / "epoch_0000" / "tensors" / "index.jsonl"
    paths = {json.loads(l)["path"] for l in index.read_text().splitlines() if l.strip()}
    names = {name for name, _ in net.named_modules() if name}
    assert names | {"model"} <= paths


def test_watch_paths_are_globs_and_hooks_end_with_the_run(tmp_path):
    net = torch.nn.Sequential(
        torch.nn.Sequential(torch.nn.Linear(4, 4), torch.nn.ReLU()),
        torch.nn.Linear(4, 2),
    )

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        log.watch(net, paths=["0.*"])
        net(torch.randn(1, 4))

    main()
    index = _rundir(tmp_path) / "epoch_0000" / "tensors" / "index.jsonl"
    paths = {json.loads(l)["path"] for l in index.read_text().splitlines() if l.strip()}
    assert paths == {"0.0", "0.1"}
    assert all(not module._forward_hooks for module in net.modules())


def test_watch_a_module_called_twice_in_one_step_keeps_both_outputs(tmp_path):
    import numpy as np

    class Shared(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.block = torch.nn.Linear(2, 2)

        def forward(self, x):
            return self.block(torch.relu(self.block(x)))

    net = Shared()
    outputs = []
    net.block.register_forward_hook(lambda _m, _i, out: outputs.append(out.detach().numpy().copy()))

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        log.watch(net, paths=["block"])
        for step in range(2):
            log.log("loss", 1.0, step=step)
            net(torch.ones(1, 2))

    main()
    tensors = _rundir(tmp_path) / "epoch_0000" / "tensors"
    rows = [json.loads(line) for line in (tensors / "index.jsonl").read_text().splitlines() if line.strip()]
    assert [(row["path"], row["step"]) for row in rows] == [("block", 0), ("block@2", 0), ("block", 1), ("block@2", 1)]
    assert np.allclose(np.load(tensors / rows[0]["file"]), outputs[0])
    assert np.allclose(np.load(tensors / rows[1]["file"]), outputs[1])


def test_checkpoint_cadence(tmp_path):
    net = torch.nn.Linear(2, 2)

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        for step in range(1, 26):
            log.log("loss", 1.0 / step, step=step)
            log.checkpoint(net, every=10, keep_top_k=5, metric="loss", mode="min")

    main()
    steps = sorted(json.loads(l)["step"] for l in (_rundir(tmp_path) / "checkpoints" / "index.jsonl").read_text().splitlines() if l.strip())
    assert steps == [10, 20]


def test_checkpoint_rotation_keeps_top_k_plus_latest(tmp_path):
    net = torch.nn.Linear(2, 2)

    @log.run(project="p", runs_root=str(tmp_path))
    def main():
        for step, loss in enumerate([0.5, 0.1, 0.9, 0.2, 0.3], start=1):
            log.log("loss", loss, step=step)
            log.checkpoint(net, every=1, keep_top_k=2, metric="loss", mode="min", tag=f"c{step}")

    main()
    names = {p.name for p in (_rundir(tmp_path) / "checkpoints").glob("*.pt")}
    assert len(names) <= 3
    assert "c5.pt" in names


def test_resume_zero_then_explicit(tmp_path):
    net = torch.nn.Linear(2, 2)

    @log.run(project="p", name="r1", runs_root=str(tmp_path))
    def first():
        assert log.resume_state(net) == 0
        log.log("loss", 0.1, step=5)
        log.checkpoint(net, every=5, keep_top_k=5, metric=None, tag="step5")

    first()
    ckpt = tmp_path / "p" / "r1" / "checkpoints" / "step5.pt"
    captured = {}

    @log.run(project="p", name="r2", runs_root=str(tmp_path))
    def second():
        captured["step"] = log.resume_state(net, checkpoint=str(ckpt))

    second()
    assert captured["step"] == 5
    meta = json.loads((tmp_path / "p" / "r2" / "meta.json").read_text())
    assert meta["resume_diff"] is not None


def test_export_figure_writes_png(tmp_path, monkeypatch):
    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        for step in range(5):
            log.log("loss", 1.0 / (step + 1), step=step)

    main()
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    out = tmp_path / "out.png"
    assert log.export.figure("p.r.epoch_0000.loss", str(out)) == str(out.resolve())
    assert out.exists() and out.stat().st_size > 0


def test_export_figure_nature_preset_is_a_single_column_figure(tmp_path, monkeypatch):
    from PIL import Image

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        for step in range(5):
            log.log("loss", 1.0 / (step + 1), step=step)

    main()
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    out = tmp_path / "nature.png"
    log.export.figure("p.r.epoch_0000.loss", str(out), renderer="nature")
    width_mm = Image.open(out).size[0] / 300 * 25.4
    assert width_mm <= 89
    with pytest.raises(log.errors.RendererUnavailableError):
        log.export.figure("p.r.epoch_0000.loss", str(out), renderer="proplot")


def test_export_figure_draws_what_the_ui_shows(tmp_path, monkeypatch):
    import matplotlib.axes

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        for step in range(3):
            log.log("loss", 1.0 / (step + 1), step=step)
            log.log("accuracy", step / 2, step=step)

    main()
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    drawn = {}
    original = matplotlib.axes.Axes.plot

    def record(self, xs, ys, label=None, **kwargs):
        drawn[label] = (list(xs), list(ys))
        return original(self, xs, ys, label=label, **kwargs)

    monkeypatch.setattr(matplotlib.axes.Axes, "plot", record)
    log.export.figure("p.r.metrics", str(tmp_path / "metrics.png"))
    assert drawn == {"loss": ([0, 1, 2], [1.0, 0.5, 1 / 3]), "accuracy": ([0, 1, 2], [0.0, 0.5, 1.0])}

    edited = {
        "name": "loss", "kind": "column", "column_names": ["step", "loss"], "row_names": None,
        "source_path": "p.r.epoch_0000.loss", "representation": "line",
        "cells": [[{"type": "number", "value": str(step), "ref": None}, {"type": "number", "value": "7", "ref": None}] for step in range(2)],
    }
    (tmp_path / "views").mkdir()
    (tmp_path / "views" / "p.r.epoch_0000.loss.json").write_text(json.dumps(edited))
    drawn.clear()
    log.export.figure("p.r.epoch_0000.loss", str(tmp_path / "edited.png"))
    assert drawn == {"loss": ([0.0, 1.0], [7.0, 7.0])}

    with pytest.raises(log.errors.ViewNotFoundError):
        log.export.figure("p.gone.metrics", str(tmp_path / "gone.png"))


def test_export_figure_skips_boolean_scalars(tmp_path, monkeypatch):
    import matplotlib.axes

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        for step in range(3):
            log.log("loss", 1.0 / (step + 1), step=step)
            log.log("converged", step == 2, step=step)

    main()
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    drawn = []
    original = matplotlib.axes.Axes.plot
    monkeypatch.setattr(matplotlib.axes.Axes, "plot", lambda self, xs, ys, label=None, **kw: drawn.append(label) or original(self, xs, ys, label=label, **kw))
    log.export.figure("p.r.metrics", str(tmp_path / "metrics.png"))
    assert drawn == ["loss"]


def test_a_finished_run_records_its_end_and_the_project_shows_its_duration(tmp_path):
    from backend.adapters.local_file_storage import LocalFileStorage
    from backend.domain.read_table import read_table

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        log.log("loss", 1.0, step=0)

    main()
    meta = json.loads((tmp_path / "p" / "r" / "meta.json").read_text())
    assert meta["end_wall_time"] >= meta["start_wall_time"]
    row = read_table("p", LocalFileStorage(tmp_path)).cells[0]
    assert [cell.value for cell in row[:2]] == ["r", "finished"]
    assert float(row[3].value) == round(meta["end_wall_time"] - meta["start_wall_time"], 3)


def _alerts(tmp_path):
    return [json.loads(line) for line in (tmp_path / "p" / "r" / "epoch_0000" / "alerts.jsonl").read_text().splitlines()]


def _log_clock(monkeypatch, seconds):
    monkeypatch.setattr(sys.modules["log.logger"], "time", SimpleNamespace(time=lambda: next(seconds)))


def test_built_in_alerts_write_one_row_per_onset_and_custom_checks_and_actions_join_them(tmp_path, monkeypatch):
    _log_clock(monkeypatch, itertools.count())
    acted = []

    def below_half(history):
        return "fell below 0.5" if history[-1] < 0.5 else None

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        log.alert("acc", below_half)
        log.on_alert(acted.append)
        for step in range(30):
            log.log("loss", 1.0 + 0.01 * (step % 2), step=step)
            log.log("acc", 0.9, step=step)
        log.log("loss", float("nan"), step=30)
        log.log("loss", float("nan"), step=31)
        log.log("loss", 1.0, step=32)
        log.log("loss", 50.0, step=33)
        log.log("acc", 0.1, step=33)

    main()
    rows = _alerts(tmp_path)
    assert [(row["rule"], row["path"], row["step"]) for row in rows] == [
        ("non_finite", "loss", 30),
        ("spike", "loss", 33),
        ("below_half", "acc", 33),
    ]
    assert rows[0]["message"] == "became nan" and set(rows[0]) == {"step", "wall_time", "rank", "rule", "path", "value", "message"}
    assert [(row["rule"], row["step"]) for row in acted] == [(row["rule"], row["step"]) for row in rows]


def test_a_step_far_slower_than_usual_raises_stall_and_switched_off_rules_stay_silent(tmp_path, monkeypatch):
    (tmp_path / "p").mkdir()
    (tmp_path / "p" / "project.json").write_text(json.dumps({"alerts": {"non_finite": False}}))
    _log_clock(monkeypatch, iter([*range(25), 100]))

    @log.run(project="p", name="r", runs_root=str(tmp_path))
    def main():
        for step in range(26):
            log.log("loss", float("nan") if step == 3 else 1.0, step=step)

    main()
    assert [(row["rule"], row["path"], row["step"], row["value"]) for row in _alerts(tmp_path)] == [("stall", "step", 25, 76.0)]
