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
from flask_cors import CORS
from flask_migrate import Migrate, upgrade
from sqlalchemy_utils import create_database, database_exists

from app.apis import blueprint as api
from app.connections import db
from app.models import InteractivePipelineRun, InteractiveSession


def create_app(config_class=None, use_db=True):
    """Create the Flask app and return it.

    Args:
        config_class: Configuration class. See orchest-api/app/config.
        use_db: If true, associate a database to the Flask app instance,
            which implies connecting to a given database and possibly
            creating such database and/or tables if they do not exist
            already. The reason to differentiate instancing the app
            through this argument is that the celery worker does not
            need to connect to the db that "belongs" to the orchest-api.

    Returns:
        Flask.app
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    init_logging()

    # Cross-origin resource sharing. Allow API to be requested from the
    # different microservices such as the webserver.
    CORS(app, resources={r"/*": {"origins": "*"}})

    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    if use_db:
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

            # In case of an ungraceful shutdown, these entities could be
            # in an invalid state, so they are deleted, since for sure
            # they are not running anymore.
            # To avoid the issue of entities being deleted because of a
            # flask app reload triggered by a dev mode code change, we
            # attempt to create a directory first. Since this is an
            # atomic operation that will result in an error if the
            # directory is already there, this cleanup operation will
            # run only once per container.
            try:
                os.mkdir("/tmp/interactive_cleanup_done")
                InteractiveSession.query.delete()
                InteractivePipelineRun.query.filter(
                    InteractivePipelineRun.status.in_(["PENDING", "STARTED"])
                ).delete(synchronize_session="fetch")
                db.session.commit()
            except FileExistsError:
                pass

    # Register blueprints.
    app.register_blueprint(api, url_prefix="/api")

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
            __name__: {
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
