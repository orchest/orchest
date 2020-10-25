import argparse
import contextlib
import os
import subprocess
import time
from typing import Tuple

import pyarrow as pa

import config
from _orchest.internals import config as _config
from manager import start_manager


def get_command_line_args():
    parser = argparse.ArgumentParser(description='Start plasma store and manager.')
    parser.add_argument('-m', '--memory',
                        type=int,
                        required=False,
                        default=config.STORE_MEMORY,
                        help='amount of memory for plasma store')
    parser.add_argument('-s', '--store_socket_name',
                        required=False,
                        default=config.STORE_SOCKET_NAME,
                        help='socket name to communicate with store')
    parser.add_argument('-p', '--pipeline_fname',
                        required=False,
                        default=os.path.join(_config.PROJECT_DIR, os.environ.get("PIPELINE_PATH")),
                        help='file containing pipeline description')

    args = parser.parse_args()
    return args


@contextlib.contextmanager
def start_plasma_store(
    memory: int,
    store_socket_name: str = '/tmp/plasma.sock'
) -> Tuple[str, subprocess.Popen]:
    """Starts a plasma store in a subprocess.

    Args:
        memory: The capacity of the plasma store in bytes.

    Yields:
        Socket name of the store and process in which the store was
        started.

    """
    try:
        executable = os.path.join(pa.__path__[0], 'plasma-store-server')
        command = [
            executable,
            '-s', store_socket_name,
            '-m', str(memory)
        ]

        proc = subprocess.Popen(command)

        time.sleep(0.5)

        rc = proc.poll()
        if rc is not None:
            raise RuntimeError(f'Plasma store exited unexpectedly with code "{rc}".')

        yield store_socket_name, proc

    finally:
        if proc.poll() is None:
            proc.kill()

        os.remove(store_socket_name)


def main():
    args = get_command_line_args()

    with start_plasma_store(
        memory=args.memory, store_socket_name=args.store_socket_name
    ) as (store_socket_name, _):
        # Start the manager that handles eviction by listening to the
        # notification socket of the store.
        start_manager(store_socket_name, pipeline_fname=args.pipeline_fname)


if __name__ == '__main__':
    main()
