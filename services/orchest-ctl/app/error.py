class Error(Exception):
    pass


class ENVVariableNotFoundError(Error):
    """ENV variable not found."""

    pass
