from fastapi import APIRouter

router = APIRouter()


@router.get("/api/series/scalar")
def get_scalar_series():
    """Get scalar series (stub for v0)."""
    raise NotImplementedError


@router.get("/api/series/tensor")
def get_tensor_series():
    """Get tensor series (stub for v0)."""
    raise NotImplementedError
