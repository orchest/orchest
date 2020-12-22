class Error(Exception):
    pass


class PipelineDefinitionNotFoundError(Error):
    """Error when the pipeline definition cannot be found.

    Essentially a wrapper around FileNotFoundError.
    """

    pass


class SerializationError(Error):
    """Error when an object cannot be serialized.

    Essentially a wrapper around pickle.PicklingError.
    """

    pass


class DeserializationError(Error):
    """Error when an object cannot be serialized."""

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


class DataInvalidNameError(Error):
    """Data has an invalid name"""

    pass


class InvalidMetaDataError(Error):
    """Metadata is invalid

    For metadata that is missing the separator, that does not contain
    the right amount of elements, or that has invalid content.
    """

    pass
