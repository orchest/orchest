class Config:
    STORE_SOCKET_NAME = '/tmp/plasma'
    STEP_DATA_DIR = '.data/{step_uuid}'

    @classmethod
    def get_step_data_dir(cls, step_uuid):
        return cls.STEP_DATA_DIR.format(step_uuid=step_uuid)
