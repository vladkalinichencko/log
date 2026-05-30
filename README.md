# log

Local-first ML training toolkit for PyTorch.

## Installation

```bash
pip install -e .
```

## Usage

```python
import log
import torch

@log.run(project="mnist", config={"lr": 1e-4})
def train(cfg):
    for step in range(100):
        loss = torch.rand(1).item()
        log.log("loss", loss, step=step)

train()
```

## Backend

Start the observability server:

```bash
python -m backend.main
```

## Frontend

Install and run:

```bash
cd frontend
npm install
npm run dev
```

## Structure

- `src/log/` - Training-side toolkit
- `src/backend/` - Read-only observability server
- `frontend/` - React SPA
