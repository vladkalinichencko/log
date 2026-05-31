import hashlib
import subprocess
from pathlib import Path


def git_hash() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def requirements_hash() -> str | None:
    req_path = Path("requirements.txt")
    if not req_path.exists():
        return None
    content = req_path.read_bytes()
    h = hashlib.sha256(content)
    return f"sha256:{h.hexdigest()}"


def capture_rng() -> dict:
    import random
    import numpy as np
    import torch

    rng = {
        "torch": torch.get_rng_state(),
        "numpy": np.random.get_state(),
        "python": random.getstate(),
    }
    if torch.cuda.is_available():
        rng["cuda"] = torch.cuda.get_rng_state_all()
    return rng
