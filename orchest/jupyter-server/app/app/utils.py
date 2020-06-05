import json
import requests


def shutdown_jupyter_server(
        connection_file: str, url: str = 'http://localhost:8888'
) -> bool:
    """Shuts down the Jupyter server via an authenticated POST request.

    Sends an authenticated POST request to: "url"/api/shutdown.

    Args:
        connection_file: path to the connection_file that contains the
            server information needed to connect to the Jupyter server.
        url: the url at which the Jupyter server is running.

    Returns:
        None if no Jupyter server is running. Otherwise the Response
        object from the POST request to the Jupyter server API.
    """
    # The "life" of a Jupyter server is a 1-to-1 relationship with its
    # "connection_file". If a Jupyter server is up then its
    # "connection_file" exists and vice versa. Similarly for death.
    try:
        with open(connection_file, 'r') as f:
            server_info = json.load(f)
    except FileNotFoundError:
        return False

    # Authentication is done via the token of the server.
    headers = {'Authorization': f'Token {server_info["token"]}'}

    # base_url included slash at the end
    url = url + server_info["base_url"]

    # Shutdown the server, such that it also shuts down all related
    # kernels.

    # Do not use /api/shutdown --> it is non-blocking causing container based
    # kernels to persist!
    r = requests.get(f'{url}api/kernels', headers=headers)

    kernels_json = r.json()

    for kernel in kernels_json:
        requests.delete(f'{url}api/kernels/{kernel.get("id")}', headers=headers)

    return True
