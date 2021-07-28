class ActiveSession(Exception):
    """Some operation could not be done because of an active session."""

    pass


class PipelineFileExists(Exception):
    """A pipeline file exists when it should not."""

    pass


class PipelineFileDoesNotExist(Exception):
    """A pipeline file does not exists when it should."""

    pass


class OutOfProjectError(Exception):
    """Attempting to do an operation outside of a project directory."""

    pass
