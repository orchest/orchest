"""Core functionality of orchest-ctl.

Refer to config.STATUS_CHANGING_OPERATIONS and
_k8s_wrapper.get_ongoing_status_change if you introduce new status
changing operations or if you change the name of existing ones.
"""
from app.orchest._core import install, status, version
