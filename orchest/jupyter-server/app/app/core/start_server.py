import argparse
import json
import os
import sys
from typing import Any, Dict, List

from jupyterlab.labapp import LabApp


def parse_arguments():
    parser = argparse.ArgumentParser(description='Arguments for JupyterLab Server')

    # Allowed arguments.
    parser.add_argument('--gateway-url')

    return parser.parse_args()


def format_arguments(args: argparse.Namespace) -> List[str]:
    """Replaces underscores with minusses."""
    formatted_args = []
    for arg, value in vars(args).items():
        formatted_args.append(f'--{arg.replace("_", "-")}={value}')

    return formatted_args


def _write_server_info_to_file(server_info: Dict[str, Any],
                               file_name: str,
                               respective_path: str = '../tmp/') -> None:
    """Writes server information to a file.

    The information is written to the given "file_name" with trespect to
    the "respective_path" (this path is relative to this module).

    Args:
        server_info: server information of the started JupyterLab
            instance. Example:
            {
                'base_url': '/',
                'hostname': 'localhost',
                'notebook_dir': '/notebooks',
                'password': False,
                'pid': 94619,
                'port': 8888,
                'secure': False,
                'token': '<some-token>',
                'url': 'http://localhost:8888/'
            }
        file_name: name of the file to write the information to.
        respective_path: path relative to this module to create the
            file.
    """
    # Write the server information to the "respective_path" with respect
    # to the current file.
    abs_path = os.path.dirname(os.path.abspath(__file__))
    full_name = os.path.join(abs_path, respective_path, file_name)
    with open(full_name, 'w') as f:
        json.dump(server_info, f)


def main():
    # This import should not be done w.r.t. the package. Instead this
    # file is run as a module, since it is executed in a subprocess.
    from config import NOTEBOOK_DIR

    # Formats the passed command line arguments to start the JupyterLab
    # instance. When passing command line arguments they have to be with
    # minusses "-" instead of the underscores "_" the python argparse
    # library parses them to.
    formatted_args = format_arguments(parse_arguments())

    # Add default options.
    # TODO: don't allow to run as root. But to make that work, the
    #       docker image has to be changed in order to allow another
    #       user. For now, it just works.
    formatted_args.extend([
        '--allow-root',
        '--no-browser',
        '--ip=0.0.0.0',
        '--port=8888',
        f'--notebook-dir={NOTEBOOK_DIR}'
    ])
    sys.argv.extend(formatted_args)

    # Initializes the Lab instance and writes its server info to a json
    # file that can be accessed outside of the subprocess in order to
    # connect to the started server.
    la = LabApp()
    la.initialize()

    _write_server_info_to_file(la.server_info(), 'server_info.json')

    # This print is mandatory. The message can be changed, but the
    # subprocess is piping this output to stdout to confirm that
    # the JupyterLab has successfully started.
    print('Initialized JupyterLab instance')

    # TODO: if the starting takes too long, then the front-end will
    #       already try to connect to the lab instance. Resulting in an
    #       error. This should obviously be more robust.
    la.start()


if __name__ == '__main__':
    main()
