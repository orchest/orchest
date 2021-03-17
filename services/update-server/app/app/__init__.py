"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask

from app.config import CONFIG_CLASS
from app.views import register_views


def create_app():
    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    register_views(app)

    return app
