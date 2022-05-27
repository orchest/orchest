"""Orchest CLI.

Note:
    A table (similar to the Orchest SDK) that checks whether the CLI
    version is compatible with the Orchest Cluster version is pretty
    much useless. The most likely situation CLI users are in is that the
    Orchest Cluster is on a newer version that the CLI does not fully
    support. However, the CLI can't possibly know this (it can only know
    if it itself is "too new" for the Orchest Cluster).

    Therefore, it is a good idea to add error-handling to the CLI
    commands in such a way that it indicates it needs to be updated
    (or downgraded) whenever it tries to change the CRD in a way that is
    no longer (or not yet) supported.

"""
