import os

from _orchest.internals import config as _config


class Config:

    NAMESPACE = _config.ORCHEST_NAMESPACE
    SESSION_UUID = os.environ["ORCHEST_SESSION_UUID"]
    LOGS_PATH = os.environ.get("LOGS_PATH", _config.LOGS_PATH)
    PIPELINE_FILE_PATH = os.environ.get("ORCHEST_PIPELINE_FILE", _config.PIPELINE_FILE)
    PROJECT_DIR = os.environ.get("PROJECT_DIR", _config.PROJECT_DIR)
    SESSION_TYPE = os.environ["ORCHEST_SESSION_TYPE"]
