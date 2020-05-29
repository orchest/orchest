class Error(Exception):
    pass


class DiskInputNotFound(Error):
    """Error when the output from the previous step cannot be found."""
    pass
