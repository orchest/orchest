# jupyter-server

A pre-configured JupyterLab instance for Orchest including lab extensions and a custom patch.

## Patch
In order to make the notebook gateway kernel connect through the `nginx-proxy` we patched the
websocket handler in the notebook package (`notebook/gateway/handlers.py`). We override the
`check_origin` method as per tornado framework instruction to allow varying origins. This might
introduce a security issue, but I think it's mitigated by the Docker network not being exposed.
