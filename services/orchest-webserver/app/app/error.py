from typing import List


class ActiveSession(Exception):
    """Some operation could not be done because of an active session."""

    pass


class InvalidProjectName(Exception):

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


class OutOfDataDirectoryError(Exception):
    """Attempting to do an operation outside the data directory."""

    pass


class OutOfAllowedDirectoryError(Exception):
    """
    Attempting to do an operation outside the allowed directories,
    i.e. the data directory or a project directory.
    """

    pass


class ProjectDoesNotExist(Exception):
    pass


class PipelineDoesNotExist(Exception):
    pass


class JobDoesNotExist(Exception):
    pass


class EnvironmentsDoNotExist(Exception):
    def __init__(self, environment_uuids=List[str]):
        self.environment_uuids = environment_uuids
