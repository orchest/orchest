# Notes

There are some hardcoded configurations reapeated inside the different project. These should be
managed with some global configuration. Example would be the mounted `/notebooks` path where the
`jupyter-server` will start the Jupyter server. This path is repeated in:
* `jupyter-server/app/app/core/start_server.py`
* `orchest/orchest-api/api/core/managers.py`


## TODO
- [ ] The Orchest-API should get its own static IP address, possibly also in some global config file
    such that it does not have to be passed everywhere it is needed.
