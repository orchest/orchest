import argparse
import json
import os
import sys
from typing import List

from jupyterlab.labapp import LabApp


def parse_arguments():
    parser = argparse.ArgumentParser(description='Arguments for JupyterLab Server')

    parser.add_argument('--gateway-url')

    return parser.parse_args()


def format_arguments(args: argparse.Namespace) -> List[str]:
    """Replaces underscores with minusses."""
    formatted_args = []
    for arg, value in vars(args).items():
        formatted_args.append(f'--{arg.replace("_", "-")}={value}')

    return formatted_args


def _write_server_info_to_file(server_info, file_name, respective_path='../tmp/'):
    # Write the server information to the "respective_path" with respect
    # to the current file.
    abs_path = os.path.dirname(os.path.abspath(__file__))
    full_name = os.path.join(abs_path, respective_path, file_name)
    with open(full_name, 'w') as f:
        json.dump(server_info, f)


def main():
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
        # '--notebook-dir=/notebooks'  # TODO: make difference for when run inside docker and outside
        '--notebook-dir=/home/yannick/Documents/experiments'
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
