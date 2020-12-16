"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask
from flask_cors import CORS
from sqlalchemy_utils import create_database, database_exists

from app.apis import blueprint as api
from app.connections import db
from app.models import (
    InteractiveSession,
    InteractiveRun,
    InteractiveRunPipelineStep,
    InteractiveRunImageMapping,
)
from config import CONFIG_CLASS


def create_app(config_class=None, use_db=True):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Cross-origin resource sharing. Allow API to be requested from the
    # different microservices such as the webserver.
    CORS(app, resources={r"/*": {"origins": "*"}})

    if use_db:
        # Create the database if it does not exist yet. Roughly equal to
        # a "CREATE DATABASE IF NOT EXISTS <db_name>" call.
        if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
            create_database(app.config["SQLALCHEMY_DATABASE_URI"])

        db.init_app(app)
        with app.app_context():
            # This call will create tables if needed (the ones which do
            # not exist in the database yet).
            db.create_all()

    # Register blueprints.
    app.register_blueprint(api, url_prefix="/api")

    # create celery database if needed
    if not database_exists(CONFIG_CLASS.result_backend_sqlalchemy_uri):
        create_database(CONFIG_CLASS.result_backend_sqlalchemy_uri)

    return app
