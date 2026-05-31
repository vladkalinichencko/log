from fastapi import APIRouter

router = APIRouter()


@router.get("/api/views")
def list_views():
    return []
