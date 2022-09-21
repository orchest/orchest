from typing import Optional

import requests


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


class OrchestApiRequestError(Exception):
    """Some orchest-api request failed."""

    def __init__(self, *args, response: Optional[requests.Response] = None):
        msg = ""
        if response is not None:
            msg = [f"Status code: {response.status_code}"]
            if response.headers.get("content-type") == "application/json":
                msg.append(f"{response.json()}")
            else:
                msg.append(response.text)

        super().__init__(*args, msg)


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


class UnexpectedFileSystemState(Exception):
    pass
