"""Tests for the servers namespace of the API.

Before running the tests:
    * `app/app/core/config.py`: Set `PRODUCTION = False`. As noted in
      the top-level README.md

Difficulties:
    * Hardcoded paths. Take for example the `_write_server_info_to_file`
      function in `/core/start_server.py`

    * The Jupyter server is started in a subprocess.

    * The tests are not actually run inside the docker container.
"""
import os

import pytest
import requests

from app import create_app
from app.utils import shutdown_jupyter_server
from config import TestingConfig


@pytest.fixture
def client():
    app = create_app(config_class=TestingConfig)

    with app.test_client() as client:
        # Yielding allows for teardown code.
        yield client

    # ---- Teardown code. ----
    # Shutdown the Jupyter server and clear its connection file, if it is
    # still running.
    abs_path = os.path.dirname(os.path.abspath(__file__))
    connection_file = os.path.join(abs_path, '../app/tmp/server_info.json')

    _ = shutdown_jupyter_server(connection_file)

    if os.path.exists(connection_file):
        os.remove(connection_file)


# TODO: Note that this test tests significant logic. This is a temporary
#       solution due to the difficulties stated in this modules's
#       docstring.
def test_api_start_and_shutdown_server(client):
    # Can't get server information if no server is running.
    response = client.get('/api/servers/')
    assert response.status_code == 404
    assert response.json == {'message': 'No running server'}

    # A POST request to the Flask API should start the Jupyter server.
    some_gateway_url = 'http://0.0.0.0:8765'
    response_post = client.post('/api/servers/', json={'gateway-url': some_gateway_url})
    assert response_post.status_code == 201

    # A user should be able to interact with the start Jupyter server.
    r = requests.get('http://127.0.0.1:8888/api')
    assert r.status_code == 200
    assert r.json().get('version') is not None

    # The Flask API should now be able to check for the running server.
    response = client.get('/api/servers/')
    assert response.status_code == 200

    # Shut down the server.
    response_delete = client.delete('/api/servers/')
    assert response_delete.status_code == 200

    # Final check for the server to be dead.
    response = client.get('/api/servers/')
    assert response.status_code == 404
