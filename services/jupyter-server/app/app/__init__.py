"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask

from app.apis import blueprint as api


def create_app(config_class=None):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Register blueprints.
    app.register_blueprint(api, url_prefix="/api")

    return app
