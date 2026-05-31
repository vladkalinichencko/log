from fastapi import APIRouter

router = APIRouter()


@router.get("/api/series/scalar")
def get_scalar_series():
    raise NotImplementedError


@router.get("/api/series/tensor")
def get_tensor_series():
    raise NotImplementedError
