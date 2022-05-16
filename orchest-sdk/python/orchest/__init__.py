"""SDK to interact with Orchest.

You can do things such as:
* Pass data between pipeline steps.
* Get the value of pipeline and pipeline step parameters.

Data passing example:
>>> import orchest
>>> orchest.get_inputs()
... {"extracted-data": ..., "unnamed": []}
>>> orchest.output("Hello World!", name="welcome-msg")

"""
import os as __os

from orchest._version import __version__
from orchest.config import Config
from orchest.parameters import get_pipeline_param, get_step_param
from orchest.services import get_service, get_services
from orchest.transfer import get_inputs, output

orchest_version = __os.getenv("ORCHEST_VERSION")
if orchest_version is not None:

    def __lte(old: str, new: str) -> bool:
        """Returns `old < new`, i.e. less than.

        In other words, returns whether `new` is a newer version than
        `old`.

        Note:
            Both `old` and `new` must follow the same versioning scheme:
            * CalVer, e.g. "v2022.03.8", or
            * SemVer, e.g. "0.3.10"

        """
        if old.startswith("v") and new.startswith("v"):
            old, new = old[1:], new[1:]
        elif old.startswith("v") or new.startswith("v"):
            raise ValueError("All arguments should follow the same versioning scheme.")

        for o, n in zip(old.split("."), new.split(".")):
            if int(o) > int(n):
                return False
            elif int(o) < int(n):
                return True
        return True

    def __gt(old: str, new: str) -> bool:
        return not __lte(old, new)

    # Check for version compatibility between the orchest-sdk and the
    # Orchest application.
    if __lte(orchest_version, "v2021.05.0"):  # starting point
        pass
    elif __gt(orchest_version, "v2021.05.0") and __lte(__version__, "0.0.2"):
        import warnings

        warnings.warn(
            "The Orchest SDK seems to have an incompatible version"
            " with respect to the Orchest application. Please upgrade"
            " the SDK version according to https://pypi.org/project/orchest/."
        )
    elif (
        (__gt(orchest_version, "v2021.05.0") and __lte(__version__, "0.0.2"))
        # Pre/post k8s.
        or (__lte(orchest_version, "v2022.03.6") and __gt(__version__, "0.3.7"))
        or (__gt(orchest_version, "v2022.03.6") and __lte(__version__, "0.3.7"))
    ):

        import warnings

        warnings.warn(
            "The Orchest SDK seems to have an incompatible version"
            " with respect to the Orchest application. Please upgrade"
            " the SDK version according to https://pypi.org/project/orchest/."
        )
