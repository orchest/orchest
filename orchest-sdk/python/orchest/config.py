"""

CAUTION:
    DO NOT USE THE INTERNAL LIBRARY IN THE CODE OF THE SDK. THIS CAN
    CAUSE CONFLICTS WITH THE LICENSES.

"""


class Config:
    # TODO: put configuration options inside the docstring so we can use
    #       it for the autodoc generation.

    # Data directory for outputting to disk. Note that it uses the
    # base directory in which the function is called.
    STEP_DATA_DIR = "/pipeline-dir/.orchest/data/{step_uuid}"

    # Path to the file that contains the pipeline description.
    PIPELINE_DESCRIPTION_PATH = "/pipeline-dir/.orchest/pipeline.json"

    # Only fill the Plasma store to 95% capacity. Otherwise the
    # additional messages for eviction cannot be inserted. NOTE:
    # trying to use 100% might therefore raise a MemoryError.
    MAX_RELATIVE_STORE_CAPACITY = 0.95

    # Where all the functions will look for the plasma.sock file. Note
    # however, the plasma.sock file is not created by the sdk. This
    # configuration value only specifies where the sdk will look for the
    # socket to connect to the plasma store.
    STORE_SOCKET_NAME = "/tmp/orchest/plasma.sock"

    # For transfer.py
    IDENTIFIER_SERIALIZATION = 1
    IDENTIFIER_EVICTION = 2
    CONN_NUM_RETRIES = 20

    # For datasources.py
    INTERNAL_DATASOURCES = ["_default"]

    @classmethod
    def get_step_data_dir(cls, step_uuid):
        return cls.STEP_DATA_DIR.format(step_uuid=step_uuid)
