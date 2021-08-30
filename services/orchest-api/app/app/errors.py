class SessionInProgressException(Exception):
    pass


class JupyterBuildInProgressException(Exception):
    pass


class SessionContainerError(Exception):
    pass


class PipelineDefinitionNotValid(Exception):
    pass
