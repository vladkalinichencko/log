from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class ApiError(Exception):

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def api_error_response(_: Request, error: Exception) -> JSONResponse:
    error = _as_api_error(error)
    return JSONResponse(
        status_code=error.status,
        content={"error": {"code": error.code, "message": error.message}},
    )


def _as_api_error(error: Exception) -> ApiError:
    if isinstance(error, ApiError):
        return error
    if isinstance(error, RequestValidationError):
        return ApiError(422, "INVALID_REQUEST", "; ".join(
            f"{'.'.join(map(str, detail['loc']))}: {detail['msg']}" for detail in error.errors()
        ))
    if isinstance(error, HTTPException):
        return ApiError(error.status_code, f"HTTP_{error.status_code}", str(error.detail))
    return ApiError(500, "INTERNAL_ERROR", f"{type(error).__name__}: {error}")


ERROR_SOURCES = (ApiError, RequestValidationError, HTTPException, Exception)
