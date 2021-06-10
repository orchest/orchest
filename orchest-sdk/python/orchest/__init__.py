import os as __os

from orchest._version import __version__
from orchest.config import Config
from orchest.parameters import (
    get_pipeline_param,
    get_step_param,
    update_pipeline_param,
    update_step_param,
)
from orchest.services import get_service, get_services
from orchest.transfer import get_inputs, output

orchest_version = __os.getenv("ORCHEST_VERSION")
if orchest_version is not None:
    # Check for version compatibility between the orchest-sdk and the
    # Orchest application.
    if orchest_version < "v2021.05.1":  # starting point
        pass
    elif orchest_version >= "v2021.05.1" and __version__ < "0.2.0":
        import warnings

        warnings.warn(
            "The Orchest SDK seems to have an incompatible version"
            " with respect to the Orchest application. Please upgrade"
            " the SDK version according to https://pypi.org/project/orchest/."
        )
