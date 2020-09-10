class Error(Exception):
    pass


class ENVVariableNotFound(Error):
    """ENV variable not found."""
    pass
