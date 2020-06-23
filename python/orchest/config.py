# Template full path to write data of individual steps to.
STEP_DATA_DIR = '.data/{step_uuid}'

STORE_SOCKET_NAME = '/tmp/plasma'


# TODO: maybe we can make this into a configuration class object.
# NOTE: without this function the "STEP_DATA_DIR" variable cannot be
# patched within the tests to allow for a custom location. This probably
# has something to do with the fact that `.format` is called.
def get_step_data_dir(step_uuid):
    return STEP_DATA_DIR.format(step_uuid=step_uuid)


def get_store_socket_name():
    return STORE_SOCKET_NAME
