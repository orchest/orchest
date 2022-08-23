import os


class Config:
    CLUSTER_NODE = os.environ["CLUSTER_NODE"]


CONFIG_CLASS = Config

__all__ = [CONFIG_CLASS]
