from fastapi import APIRouter

router = APIRouter()


@router.get("/api/views")
def list_views():
    """List views (stub for v0)."""
    return []
