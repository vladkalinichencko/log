import pytest
from pathlib import Path
from backend.domain.read_table import read_table


def test_read_table_runs_root(tmp_path):
    """Test reading the runs root returns a folder of projects."""
    # Create a project directory
    project_dir = tmp_path / "test_project"
    project_dir.mkdir()

    table = read_table("", tmp_path)

    assert table.name == "Projects"
    assert table.kind.value == "folder"
    assert len(table.cells) == 1
    assert table.cells[0][0].value == "test_project"
