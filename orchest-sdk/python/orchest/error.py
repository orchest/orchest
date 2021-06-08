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
    """Error when an object cannot be deserialized."""

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


class StepUUIDResolveError(Error):
    """Step UUID could not be resolved."""

    pass


class InputNameCollisionError(Error):
    """Multiple input data objects have the same name."""

    pass


class DataInvalidNameError(Error):
    """Data has an invalid name."""

    pass


class ServiceNotFound(Error):
    """Error when a service could not be found by name."""

    pass


class InvalidMetaDataError(Error):
    """Metadata is invalid."""

    helper_message = (
        "The issue might be caused due to cached metadata when upgrading to "
        'the new version of Orchest, try to delete the ".orchest/pipelines" '
        "directory inside your pipeline directory or try rerunning the steps "
        "that produced data."
    )

    def __init__(self, msg="", *args, **kwargs):
        # Avoid having a prefixing space if the msg is empty.
        if msg:
            msg = " ".join([msg, self.helper_message])
        else:
            msg = self.helper_message
        super().__init__(msg, *args, **kwargs)


class UnrecognizedSessionType(Error):
    """Error when a session type not in interactive, noninteractive."""

    pass


class SessionNotFound(Error):
    """Error when a session wasn't found through the orchest-api."""

    pass
