import json
import requests


def shutdown_jupyter_server(connection_file, url='http://localhost:8888'):
    """Shuts down the Jupyter server corresponding to the connection_file.

    Args:
        connection_file (str): path to the connection_file that contains
            the server information needed to connect to the Jupyter server.

    Kwargs:
        url (str): the url at which the Jupyter server is running.

    Returns:
        None if no Jupyter server is running. Otherwise the Response
        object from a POST request to the Jupyter server API.
    """
    # The "life" of a Jupyter server is a 1-to-1 relationship with its
    # connection_file. If a Jupyter server is up than its connection_file
    # exists and vice versa. Similarly for death.
    try:
        with open(connection_file, 'r') as f:
            server_info = json.load(f)
    except FileNotFoundError:
        return

    # Authentication is done via the token of the server.
    headers = {'Authorization': f'Token {server_info["token"]}'}

    # Shutdown the server, such that it also shuts down all related
    # kernels.
    r = requests.post(f'{url}/api/shutdown', headers=headers)

    return r
