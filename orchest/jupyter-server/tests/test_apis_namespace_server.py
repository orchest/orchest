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


@pytest.fixture
def client():
    # # TODO: obviously this "None" should become the app
    # with None.app.test_client() as client:
    #     yield client
    pass


def test_get_no_server(client):
    pass


def test_get_running_server(client):
    # First run the server using the post request.
    pass


def test_post(client):
    # Check whether the Jupyter server was indeed started. Use the Jupyter
    # API and poll whether it is alive.
    pass


def test_delete_no_server(client):
    pass


def test_delete_running_server(client):
    pass

