# TODO: make sure the user can actually configure by using this object.
# TODO: put configuration options inside the docstring so we can use it
#       for the autodoc generation.
class Config:
    # Only fill the Plasma store to 95% capacity. Otherwise the
    # additional messages for eviction cannot be inserted. NOTE:
    # trying to use 100% might therefore raise a MemoryError.
    MAX_RELATIVE_STORE_CAPACITY = 0.95
    STEP_DATA_DIR = '.orchest/data/{step_uuid}'
    STORE_SOCKET_NAME = '/tmp/plasma'

    @classmethod
    def get_step_data_dir(cls, step_uuid):
        return cls.STEP_DATA_DIR.format(step_uuid=step_uuid)
