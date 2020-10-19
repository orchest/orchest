"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask
from flask_cors import CORS

from app.apis import blueprint as api
from app.connections import db


def create_app(config_class=None, use_db=True):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Cross-origin resource sharing. Allow API to be requested from the
    # different microservices such as the webserver.
    CORS(app, resources={r"/*": {"origins": "*"}})

    if use_db:
        # Initialize the database and create the database file.
        db.init_app(app)
        with app.app_context():
            db.create_all()

    # Register blueprints.
    app.register_blueprint(api, url_prefix="/api")

    return app
