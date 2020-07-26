# Notes

There are some hardcoded configurations reapeated inside the different project. These should be
managed with some global configuration. Example would be the mounted `/pipeline-dir` path where the
`jupyter-server` will start the Jupyter server. This path is repeated in:
* `jupyter-server/app/app/core/start_server.py`
* `orchest/orchest-api/api/core/managers.py`
