class Error(Exception):
    pass


class ObjectNotFoundError(Error):
    """Error when the object cannot be found in the in-memory store.

    Similar to FileNotFoundError.
    """

    pass


class OutputNotFoundError(Error):
    """Error when the output from a previous step cannot be found."""

    pass


class DiskOutputNotFoundError(OutputNotFoundError):
    """InputNotFoundError for disk specifically."""

    pass


class MemoryOutputNotFoundError(OutputNotFoundError):
    """InputNotFoundError for memory specifically."""

    pass


class OrchestNetworkError(Error):
    """Resource fails to respond or is unable to fulfil the request."""

    pass


class OrchestInternalDataSourceError(Error):
    """It is not allowed to request internal data sources."""

    pass


class StepUUIDResolveError(Error):
    """Step UUID could not be resolved."""

    pass


class InputNameCollisionError(Error):
    """Multiple input data objects have the same name"""

    pass
