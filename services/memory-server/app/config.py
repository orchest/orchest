import os

from _orchest.internals import config as _config

# Default location where the socket is created.
STORE_SOCKET_NAME = os.path.join(_config.MEMORY_SERVER_SOCK_PATH, "plasma.sock")

# Used to determine whether objects need to be evicted.
PIPELINE_FNAME = os.environ.get("ORCHEST_PIPELINE_PATH", "")
