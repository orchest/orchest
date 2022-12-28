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


class GitImportError(Exception):
    pass


class GitCloneFailed(GitImportError):
    def __init__(self, *args, status_code: int, stdout: str, stderr: str, **kwargs):
        self.status_code = status_code
        self.stdout = stdout
        self.stderr = stderr
        super().__init__(*args)


class ProjectWithSameNameExists(GitImportError):
    pass


class ProjectNotDiscoveredByWebServer(GitImportError):
    pass


class NoAccessRightsOrRepoDoesNotExists(GitImportError):
    pass
