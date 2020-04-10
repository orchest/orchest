from argparse import Namespace

from app.core.start_server import format_arguments


def test_format_arguments():
    args = Namespace(**{
        'first': None,
        'gateway_url': None
    })

    assert format_arguments(args) == ['--first=None', '--gateway-url=None']
