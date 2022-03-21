"""Orchest session management, from start to stop and all in-between.

The provided functions, generally speaking, work through the
session_uuid as the only information required to interact with the
session. They are, mostly, a wrapper around the k8s API combined with
some internal business logic.

Some functions allow to interact with a specific service or resource, it
is responsibility of the caller to know what kind of service or resource
a session was started with. Altough, implementation-wise, allowing for
the retrieval of such information should be quite straightforward.

"""
from app.core.sessions._core import (
    cleanup_resources,
    has_busy_kernels,
    launch,
    launch_noninteractive_session,
    restart_session_service,
    shutdown,
)
