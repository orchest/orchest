import json
import os
import sys
import argparse
import subprocess
import logging
import time
import requests

from typing import Any, Dict


def _write_server_info_to_file(
    server_info: Dict[str, Any], file_name: str, respective_path: str = "../tmp/"
) -> None:
    """Writes server information to a file.

    The information is written to the given "file_name" with trespect to
    the "respective_path" (this path is relative to this module).

    Args:
        server_info: server information of the started JupyterLab
            instance. Example:
            {
                'base_url': '/',
                'port': 8888,
            }
        file_name: name of the file to write the information to.
        respective_path: path relative to this module to create the
            file.
    """
    # Write the server information to the "respective_path" with respect
    # to the current file.
    abs_path = os.path.dirname(os.path.abspath(__file__))
    full_name = os.path.join(abs_path, respective_path, file_name)
    with open(full_name, "w") as f:
        json.dump(server_info, f)


def main():
    # Add default options.
    # TODO: don't allow to run as root. But to make that work, the
    #       docker image has to be changed in order to allow another
    #       user. For now, it just works.
    formatted_args = [
        "--port=8888",
        "--allow-root",
        "--no-browser",
        "--debug",
    ]

    # remove first arg (script name)
    sys.argv.extend(formatted_args)

    parser = argparse.ArgumentParser(description="Jupyter Lab args")
    parser.add_argument("--ServerApp.base_url", required=True, type=str)
    parser.add_argument("--port", required=True, type=int)
    args, _ = parser.parse_known_args()
    parsed_args = vars(args)

    # Initializes the Lab instance and writes its server info to a json
    # file that can be accessed outside of the subprocess in order to
    # connect to the started server.

    # This print is mandatory. The message can be changed, but the
    # subprocess is piping this output to stdout to confirm that
    # the JupyterLab has successfully started.
    print("Initialized JupyterLab instance")

    # TODO: if the starting takes too long, then the front-end will
    #       already try to connect to the lab instance. Resulting in an
    #       error. This should obviously be more robust.
    args = ["jupyter", "lab"]

    # don't include script argument
    args.extend([arg for arg in sys.argv[1:]])

    logging.info(args)

    # Start a Jupyter lab within a subprocess.
    proc = subprocess.Popen(args=args, stdout=subprocess.PIPE)

    # Write connection file once JupyterLab is reachable
    jupyterlab_running = False

    for _ in range(10):
        time.sleep(1)
        try:
            r = requests.get(
                f"http://127.0.0.1:{parsed_args['port']}{parsed_args['ServerApp.base_url']}api",
                timeout=1,
            )
            r.raise_for_status()

            jupyterlab_running = True
            break
        except:
            logging.info("Still booting JupyterLab...")

    if jupyterlab_running:
        _write_server_info_to_file(
            {
                "port": parsed_args["port"],
                "base_url": parsed_args["ServerApp.base_url"],
            },
            "server_info.json",
        )

        # make this process blocking
        proc.wait()


if __name__ == "__main__":
    main()
