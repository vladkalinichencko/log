from fastapi import APIRouter

router = APIRouter()


@router.get("/api/workspaces")
def list_workspaces():
    """List workspaces (stub for v0)."""
    return []
