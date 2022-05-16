"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import json
import os
from logging.config import dictConfig
from pprint import pformat

import requests
import werkzeug
from flask import Flask, request
from flask_migrate import Migrate
from sqlalchemy_utils import create_database, database_exists

from app.connections import db
from app.views import register_views
from config import CONFIG_CLASS


def create_app(config_class=None, to_migrate_db=False):
    """Create the Flask app and return it.

    Args:
        to_migrate_db: If True, then only initialize the db.

    Returns:
        Flask.app
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    if not to_migrate_db:
        orchest_config = requests.get(
            f"http://{CONFIG_CLASS.ORCHEST_API_ADDRESS}/api/ctl/orchest-settings"
        ).json()
        app.config.update(orchest_config)

    init_logging()

    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    # Create the database if it does not exist yet. Roughly equal to
    # a "CREATE DATABASE IF NOT EXISTS <db_name>" call.
    if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
        create_database(app.config["SQLALCHEMY_DATABASE_URI"])

    db.init_app(app)
    # necessary for migration
    Migrate().init_app(app, db)

    # NOTE: In this case we want to return ASAP as otherwise the DB
    # might be called (inside this function) before it is migrated.
    if to_migrate_db:
        return app

    register_views(app)

    return app


def init_logging():
    logging_config = {
        "version": 1,
        "formatters": {
            "verbose": {
                "format": (
                    "%(levelname)s:%(name)s:%(filename)s - [%(asctime)s] - %(message)s"
                ),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
            "minimal": {
                "format": ("%(levelname)s:%(name)s:%(filename)s - %(message)s"),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "verbose",
            },
            "console-minimal": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "minimal",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
        },
        "loggers": {
            # NOTE: this is the name of the Flask app, since we use
            # ``__name__``. Using ``__name__`` is required for the app
            # to function correctly. See:
            # https://blog.miguelgrinberg.com/post/why-do-we-pass-name-to-the-flask-class
            __name__: {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "alembic": {
                "handlers": ["console"],
                "level": "WARNING",
            },
            "werkzeug": {
                # NOTE: Werkzeug automatically creates a handler at the
                # level of its logger if none is defined.
                "level": "INFO",
                "handlers": ["console-minimal"],
            },
            "gunicorn": {
                "handlers": ["console"],
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "orchest-lib": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
        },
    }

    dictConfig(logging_config)


def register_teardown_request(app):
    @app.after_request
    def teardown(response):
        # request.is_json might not reflect what's really there.
        try:
            json_body = pformat(request.get_json())
        except (json.decoder.JSONDecodeError, werkzeug.exceptions.BadRequest) as e:
            app.logger.debug(f"No Json body found: {e}")
            json_body = None

        app.logger.debug(
            "%s %s %s\n[Request object]: %s",
            request.method,
            request.path,
            response.status,
            json_body,
        )
        return response

    return app
