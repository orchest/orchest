class SessionInProgressException(Exception):
    pass


class JupyterBuildInProgressException(Exception):
    pass


class SessionContainerError(Exception):
    pass


class DockerImageNotFound(Exception):
    def __init__(self, message, errors=None):
        super().__init__(message)

        self.errors = errors
