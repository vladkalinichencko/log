class LogError(Exception):

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidStepUnitError(LogError):
    pass


class ConfigSerializationError(LogError):
    pass


class InvalidPathError(LogError):
    pass


class UnsupportedValueTypeError(LogError):
    pass


class NotADataLoaderError(LogError):
    pass


class InvalidStrategyError(LogError):
    pass


class InvalidModeError(LogError):
    pass


class InvalidScheduleArgsError(LogError):
    pass


class ViewNotFoundError(LogError):
    pass


class NoActiveRunError(LogError):
    pass


class RunDirectoryError(LogError):
    pass


class DistributedInitError(LogError):
    pass


class CheckpointStateError(LogError):
    pass


class CheckpointReadError(LogError):
    pass


class StateRestoreError(LogError):
    pass


class RendererUnavailableError(LogError):
    pass
