import json

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
    assert names <= paths


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
    log.export.figure("p.r.epoch_0000.loss", str(out))
    assert out.exists() and out.stat().st_size > 0
