from typing import List


class SessionInProgressException(Exception):
    pass


class JupyterEnvironmentBuildInProgressException(Exception):
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


class ImageNotFoundWithUUIDs(Exception):
    def __init__(self, uuids: List[str], *args):
        self.uuids = uuids
        super().__init__(*args)


class PipelinesHaveInvalidEnvironments(Exception):
    def __init__(self, uuids: List[str], *args):
        self.uuids = uuids
        super().__init__(*args)


class ImageRegistryDeletionError(Exception):
    pass


class DeliveryFailed(Exception):
    pass
