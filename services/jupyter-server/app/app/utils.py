import json
import requests


def shutdown_jupyter_server(
    connection_file: str, url: str = "http://localhost:8888"
) -> bool:
    """Shuts down the Jupyter server via an authenticated POST request.

    Sends an authenticated DELETE request to:
        "url"/api/kernels/<kernel.id>
    for every running kernel. And then shuts down the Jupyter server
    itself via an authenticated POST request to:
        "url"/api/shutdown

    Args:
        connection_file: path to the connection_file that contains the
            server information needed to connect to the Jupyter server.
        url: the url at which the Jupyter server is running.

    Returns:
        False if no Jupyter server is running. True otherwise.
    """
    # The "life" of a Jupyter server is a 1-to-1 relationship with its
    # "connection_file". If a Jupyter server is up then its
    # "connection_file" exists and vice versa. Similarly for death.
    try:
        with open(connection_file, "r") as f:
            server_info = json.load(f)
    except FileNotFoundError:
        return False

    # Due to the running "nginx_proxy" to route traffic for the Orchest
    # application. A "base_url" is included for Jupyter, which contains
    # a slash at the end, e.g. "base/url/".
    url = url + server_info["base_url"]

    # Shutdown the server, such that it also shuts down all related
    # kernels.
    # NOTE: Do not use /api/shutdown to gracefully shut down all kernels
    # as it is non-blocking, causing container based kernels to persist!
    r = requests.get(f"{url}api/kernels")

    kernels_json = r.json()

    # In case there are connection issue with the Gateway, then the
    # "kernels_json" will be a dictionary:
    # {'message': "Connection refused from Gateway server url, ...}
    # Thus we first check whether we can indeed start shutting down
    # kernels.
    if isinstance(kernels_json, list):
        for kernel in kernels_json:
            requests.delete(f'{url}api/kernels/{kernel.get("id")}')

    # Now that all kernels all shut down, also shut down the Jupyter
    # server itself.
    r = requests.post(f"{url}api/shutdown")

    return True
