from fastapi import APIRouter

router = APIRouter()


@router.get("/api/workspaces")
def list_workspaces():
    return []
