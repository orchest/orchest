class SessionInProgressException(Exception):
    pass


class JupyterBuildInProgressException(Exception):
    pass


class SessionContainerError(Exception):
    pass


class PipelineDefinitionNotValid(Exception):
    pass


class NoSuchSessionServiceError(Exception):
    pass


class SessionCleanupFailedError(Exception):
    pass


class PodNeverReachedExpectedStatusError(Exception):
    pass


class ImageCachingFailedError(Exception):
    pass


class ImageBuildFailedError(Exception):
    pass


class ImageNotFound(Exception):
    pass
