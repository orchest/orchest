class Error(Exception):
    pass


class DiskInputNotFoundError(Error):
    """Error when the output from a previous step cannot be found."""
    pass
