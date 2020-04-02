"""Tests functionality of starting the Jupyterlab insance.

TODO:
    * The `main` function is not tested, because this is a integration
      test and should be done on the docker container to test its
      endpoints.
      Testing it now would require to call the function in a subprocess.
"""
from argparse import Namespace

from app.core.start_server import format_arguments, main


def test_format_arguments():
    args = Namespace(**{
        'first': None,
        'sec_ond': None
    })

    assert format_arguments(args) == ['--first=None', '--sec-ond=None']
