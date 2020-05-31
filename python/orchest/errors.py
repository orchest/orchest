class Error(Exception):
    pass


class DiskInputNotFoundError(Error):
    """Error when the output from a previous step cannot be found."""
    pass


class OrchestNetworkError(Error):
    """Resource fails to respond or is unable to fulfil the request."""
    pass


class StepUUIDResolveError(Error):
    """Step UUID could not be resolved."""
    pass
