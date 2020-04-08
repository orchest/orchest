"""Tests for the server namespace API.

Difficulties:
    * The Server.connection_file can be mocked, but the path in the
      core.start_server._write_server_info_to_file then also needs to be
      called accordingly (which is called in a subprocess). The mock is
      done to ensure the server information is written in a test directory
      to have a clean beginning of the test.

    * Cleanup is harder due to the subprocess.
"""
import pytest
import requests

from app import create_app
from config import TestingConfig


@pytest.fixture
def client():
    app = create_app(config_class=TestingConfig)

    with app.test_client() as client:
        yield client

    # Teardown code.
    # TODO: cleanup the connection_file if it exists.
    #       Make sure the server is no longer running


def test_start_and_shutdown_server(client):
    # TODO: note that this only works if indeed nothing is already running
    #       at the IPs and PORTs below.

    # No running server.
    response = client.get('/api/servers/')
    assert response.status_code == 404
    assert response.json == {'message': 'No running server'}

    # TODO: This post uses a the flask "request" context. So not sure
    #       whether the test_request_context has to be used. See:
    #       https://stackoverflow.com/questions/17375340/testing-code-that-requires-a-flask-app-or-request-context

    # Start the Jupyter server and check whether it is indeed running.
    response_post = client.post('/api/servers/', json={'gateway-url': 'http://0.0.0.0:8765'})
    assert response_post.status_code == 201

    r = requests.get('http://127.0.0.1:8888/api')
    assert r.status_code == 200
    assert r.json().get('version') is not None

    # Check whether the server can be found.
    response = client.get('/api/servers/')
    assert response.status_code == 200

    # Shut down the server and whether it no longer exists.
    response_delete = client.delete('/api/servers/')
    assert response_delete.status_code == 200

    r = requests.get('http://127.0.0.1:8888/api')
    assert r.status_code == 404
