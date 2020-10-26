import os

from _orchest.internals import config as _config

# Default location where the socket is created.
STORE_SOCKET_NAME = os.path.join(_config.MEMORY_SERVER_SOCK_PATH, "plasma.sock")

STORE_MEMORY = 1000000000  # 1 GB
# "System memory request exceeds memory available in /dev/shm."
# STORE_MEMORY = 60397977  # default max by docker
