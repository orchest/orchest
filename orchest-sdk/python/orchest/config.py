"""

CAUTION:
    DO NOT USE THE INTERNAL LIBRARY IN THE CODE OF THE SDK. THIS CAN
    CAUSE CONFLICTS WITH THE LICENSES.

"""

import os


class Config:
    # TODO: put configuration options inside the docstring so we can use
    #       it for the autodoc generation.

    SESSION_UUID = os.getenv("ORCHEST_SESSION_UUID")
    SESSION_TYPE = os.getenv("ORCHEST_SESSION_TYPE")
    PROJECT_UUID = os.getenv("ORCHEST_PROJECT_UUID")
    PIPELINE_UUID = os.getenv("ORCHEST_PIPELINE_UUID", "")
    PIPELINE_DEFINITION_PATH = os.getenv("ORCHEST_PIPELINE_PATH")

    # Necessary to query the orchest-api for the current interactive
    # session specs.
    ORCHEST_API_ADDRESS = "orchest-api"

    # Data directory for outputting to disk. Note that it uses the
    # base directory in which the function is called.
    # '/project-dir' as project root is hardcoded because code sharing
    # with the internal config library is not possible due to the
    # license difference.
    STEP_DATA_DIR = (
        "/project-dir/.orchest/pipelines/" + PIPELINE_UUID + "/data/{step_uuid}"
    )

    # Only fill the Plasma store to 95% capacity. Otherwise the
    # additional messages for eviction cannot be inserted. NOTE:
    # trying to use 100% might therefore raise a MemoryError.
    MAX_RELATIVE_STORE_CAPACITY = 0.95

    # Where all the functions will look for the plasma.sock file. Note
    # however, the plasma.sock file is not created by the sdk. This
    # configuration value only specifies where the sdk will look for the
    # socket to connect to the plasma store.
    STORE_SOCKET_NAME = "/project-dir/.orchest/plasma.sock"

    # For transfer.py
    IDENTIFIER_SERIALIZATION = 1
    IDENTIFIER_EVICTION = 2
    CONN_NUM_RETRIES = 20
    # Separator for the metadata related to stored data, both to disk
    # and to memory.
    __METADATA_SEPARATOR__ = "; "
    # Reserved key of the aggregated unnamed outputs list in the
    # dictionary returned by ``get_inputs()``.
    _RESERVED_UNNAMED_OUTPUTS_STR = "unnamed"

    # Calling get_inputs() or any output* function multiple times
    # produces a warning, setting this to True allows you to silence
    # those warnings.
    silence_multiple_data_transfer_calls_warning: bool = False

    @classmethod
    def get_step_data_dir(cls, step_uuid):
        return cls.STEP_DATA_DIR.format(step_uuid=step_uuid)
