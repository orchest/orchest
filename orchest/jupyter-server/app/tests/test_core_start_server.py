from argparse import Namespace

from app.core.start_server import format_arguments


def test_format_arguments():
    args = Namespace(**{
        'first': None,
        'sec_ond': None
    })

    assert format_arguments(args) == ['--first=None', '--sec-ond=None']
