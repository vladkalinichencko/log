import json
from pathlib import Path

ALERT_RULES = ("non_finite", "spike", "stall", "heartbeat")

PROJECT_SETTINGS_FILE = "project.json"


def read_project_settings(project_dir: Path) -> dict:
    saved_path = project_dir / PROJECT_SETTINGS_FILE
    saved = json.loads(saved_path.read_text()) if saved_path.exists() else {}
    return {
        "hero": saved.get("hero"),
        "alerts": {rule: saved.get("alerts", {}).get(rule, True) for rule in ALERT_RULES},
    }
