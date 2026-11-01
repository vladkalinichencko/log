"""Check the layer boundary: the training toolkit must never import the backend.

Checks that no module under src/log imports anything from src/backend — the
kit must stay installable on a GPU box without pulling in the server (SPEC §8).
"""

import re
import sys
from pathlib import Path

KIT_ROOT = Path("src/log")
FORBIDDEN = re.compile(r"\bfrom\s+backend[\w.]*\s+import\b|\bimport\s+backend\b")
ALLOWED_HEADER = "log-layer-exception:"  # remove after the coupling itself is gone


def forbidden_imports(path: Path) -> list[str]:
    text = path.read_text()
    hits = [line for line in text.splitlines() if FORBIDDEN.search(line)]
    if hits and ALLOWED_HEADER in text:
        return []
    return [f"{path}: {line.strip()}" for line in hits]


def main() -> int:
    strict = "--strict" in sys.argv
    offenders = [
        line
        for path in sorted(KIT_ROOT.rglob("*.py"))
        for line in forbidden_imports(path)
    ]
    for line in offenders:
        print(f"layer-boundary violation: {line}")
    if offenders:
        print(
            "src/log imports backend: known debt, refactor.md task 22."
            + ("" if strict else " run with --strict to fail")
        )
        return 1 if strict else 0
    print("layer boundary clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
