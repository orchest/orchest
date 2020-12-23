"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from logging.config import dictConfig
import os
from pprint import pformat

from flask import Flask, request
from flask_migrate import Migrate, upgrade
from sqlalchemy_utils import create_database, database_exists

from app.views import register_views
from app.connections import db


def create_app(config_class=None):
    app = Flask("auth-server")
    app.config.from_object(config_class)

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

    with app.app_context():
        # Upgrade to the latest revision. This also takes care of
        # bringing an "empty" db (no tables) on par.
        upgrade()

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
        "loggers": {
            "orchest-api": {
                "handlers": ["console"],
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
            # "sqlalchemy.engine": {
            #     "handlers": ["console"],
            #     "level": "DEBUG",
            # },
        },
    }

    dictConfig(logging_config)


def register_teardown_request(app):
    @app.after_request
    def teardown(response):
        app.logger.debug(
            "%s %s %s\n[Request object]: %s",
            request.method,
            request.path,
            response.status,
            pformat(request.get_json()),
        )
        return response

    return app
