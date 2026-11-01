"""Recreate the demo dataset the layout check drives against.

Two sibling runs on a decaying loss one with a higher learning rate, named the way
the frontend demo expects (demo.baseline, demo.high_lr). Skipped when the run
directory already holds data, so a repo checkout keeps its local dataset.
"""

from pathlib import Path

import torch
from torch.utils.data import DataLoader, TensorDataset

import log

DEMO_ROOT = Path("runs/demo")


def _seed(run: str, lr_scale: float) -> None:
    if (DEMO_ROOT / run).exists():
        return
    torch.manual_seed(1)

    @log.run(project="demo", name=run, runs_root=str(DEMO_ROOT.parent))
    def main():
        model = torch.nn.Linear(4, 1)
        optimizer = torch.optim.SGD(model.parameters(), lr=0.1 * lr_scale)
        loader = DataLoader(TensorDataset(torch.randn(40, 4), torch.randn(40, 1)), batch_size=4)

        for x, y in log.track(loader):
            model.zero_grad()
            log.log("loss", ((model(x) - y) ** 2).mean().item() * lr_scale)
            ((model(x) - y) ** 2).mean().backward()
            optimizer.step()

    main()


def main() -> None:
    _seed("baseline", 1.0)
    _seed("high_lr", 3.0)
    rich = list(DEMO_ROOT.iterdir())
    if len(rich) < 2:
        raise SystemExit("seed failed: expected two demo runs")


if __name__ == "__main__":
    main()
