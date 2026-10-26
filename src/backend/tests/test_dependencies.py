import ast
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2]
PLATFORM = {"torch", "numpy", "fastapi", "starlette", "pydantic", "uvicorn", "log", "backend"}
ADAPTERS = {
    "watchfiles": "backend/adapters/file_watcher.py",
    "matplotlib": "log/export.py",
    "sqlite3": "backend/adapters/sqlite_index.py",
}


def _imported(tree: ast.AST) -> set[str]:
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names.add(node.module.split(".")[0])
    return names


def test_every_capability_library_is_imported_only_by_its_adapter_and_nothing_is_unregistered():
    found = []
    for path in sorted(SOURCE.rglob("*.py")):
        file = path.relative_to(SOURCE).as_posix()
        if "/tests/" in f"/{file}":
            continue
        for name in _imported(ast.parse(path.read_text())):
            if name in ADAPTERS:
                if ADAPTERS[name] != file:
                    found.append(f"{file}: imports {name} outside its adapter")
            elif name not in PLATFORM and name not in sys.stdlib_module_names:
                found.append(f"{file}: unregistered dependency {name}")
    assert found == []
