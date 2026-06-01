from fastapi import APIRouter

router = APIRouter()


@router.get("/api/series/scalar")
def get_scalar_series(run: str, path: str, x: str | None = None):
    raise NotImplementedError


@router.get("/api/series/tensor")
def get_tensor_series(run: str, path: str, step: int):
    raise NotImplementedError
