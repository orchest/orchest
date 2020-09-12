import os

# TODO: add notice that some of these values have effect on the sdk!.

# PIPELINE_DIR = '/pipeline-dir'
PIPELINE_DIR = '/pipeline-dir'

# Pipeline directory.
KERNELSPECS_PATH = '.orchest/kernels'
LOGS_PATH = '.orchest/logs'
SOCK_PATH = '.orchest'
PIPELINE_DESCRIPTION_FILE = 'pipeline.json'
PIPELINE_DESCRIPTION_PATH = os.path.join('.orchest', PIPELINE_DESCRIPTION_FILE)

# Networking
ORCHEST_API_ADDRESS = 'orchest-api'

# Images
DEFAULT_BASE_IMAGES = [
    {'name': 'orchestsoftware/custom-base-kernel-py', 'language': 'python'},
    {'name': 'orchestsoftware/custom-base-kernel-r', 'language': 'r'},
]

# memory-server
MEMORY_SERVER_SOCK_PATH = '/tmp'
