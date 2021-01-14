"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""

import base64
import contextlib
import os
import subprocess
from logging.config import dictConfig
from pprint import pformat
from subprocess import Popen

import posthog
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request, send_from_directory
from flask_migrate import Migrate, upgrade
from flask_socketio import SocketIO
from sqlalchemy_utils import create_database, database_exists

from app.analytics import analytics_ping
from app.config import CONFIG_CLASS
from app.connections import db, ma
from app.models import DataSource
from app.socketio_server import register_socketio_broadcast
from app.utils import get_repo_tag, get_user_conf
from app.views.analytics import register_analytics_views
from app.views.background_tasks import register_background_tasks_view
from app.views.core import register_views
from app.views.orchest_api import register_orchest_api_views


def initialize_default_datasources(db, app):
    # pre-populate the datasources
    datasource_names = [datasource.name for datasource in DataSource.query.all()]

    for datasource in app.config["DEFAULT_DATASOURCES"]:
        if datasource["name"] not in datasource_names:

            connection_details = datasource["connection_details"]

            # subtitute $HOST_USER_DIR in absolute_host_path
            if "absolute_host_path" in connection_details:
                if "$HOST_USER_DIR" in connection_details["absolute_host_path"]:
                    absolute_host_path = connection_details["absolute_host_path"]
                    connection_details[
                        "absolute_host_path"
                    ] = absolute_host_path.replace(
                        "$HOST_USER_DIR", app.config["HOST_USER_DIR"]
                    )

            ds = DataSource(
                name=datasource["name"],
                connection_details=connection_details,
                source_type=datasource["source_type"],
            )

            db.session.add(ds)
            db.session.commit()


def process_start_gate():
    # When Flask is running in dev mode, only start processes once the
    # main process is running in 'reloading' mode. Signified by
    # WERKZEUG_RUN_MAIN=true.

    if os.environ.get("FLASK_ENV") != "development":
        return True
    elif os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        return True
    else:
        return False


@contextlib.contextmanager
def create_app_managed():

    try:
        (app, socketio, processes) = create_app()
        yield app, socketio

    finally:
        for process in processes:
            app.logger.info("Killing subprocess with PID %d" % process.pid)
            process.kill()


def create_app():
    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    init_logging()

    socketio = SocketIO(app, cors_allowed_origins="*")

    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    # read directory mount based config into Flask config
    try:
        conf_data = get_user_conf()
        app.config.update(conf_data)
    except Exception:
        app.logger.warning("Failed to load config.json")

    app.config["ORCHEST_REPO_TAG"] = get_repo_tag()

    # create thread for non-cpu bound background tasks, e.g. requests
    scheduler = BackgroundScheduler(
        job_defaults={
            # Infinite amount of grace time, so that if a task cannot be
            # instantly executed (e.g. if the webserver is busy) then it
            # will eventually be.
            "misfire_grace_time": 2 ** 31,
            "coalesce": False,
            # So that the same job can be in the queue an infinite
            # amount of times, e.g. for concurrent requests issuing the
            # same tasks.
            "max_instances": 2 ** 31,
        }
    )
    app.config["SCHEDULER"] = scheduler
    scheduler.start()

    app.logger.info("Flask CONFIG: %s" % app.config)

    # Create the database if it does not exist yet. Roughly equal to a
    # "CREATE DATABASE IF NOT EXISTS <db_name>" call.
    if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
        create_database(app.config["SQLALCHEMY_DATABASE_URI"])
    db.init_app(app)
    ma.init_app(app)
    # necessary for migration
    Migrate().init_app(app, db)

    with app.app_context():
        # Upgrade to the latest revision. This also takes care of
        # bringing an "empty" db (no tables) on par.
        upgrade()
        initialize_default_datasources(db, app)

    # Telemetry
    if not app.config["TELEMETRY_DISABLED"]:
        # initialize posthog
        posthog.api_key = base64.b64decode(app.config["POSTHOG_API_KEY"]).decode()
        posthog.host = app.config["POSTHOG_HOST"]

        # send a ping now
        analytics_ping(app)

        # and every 15 minutes
        scheduler.add_job(
            analytics_ping,
            "interval",
            minutes=app.config["TELEMETRY_INTERVAL"],
            args=[app],
        )

    # static file serving
    @app.route("/public/<path:path>")
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)
    register_orchest_api_views(app, db)
    register_background_tasks_view(app, db)
    register_socketio_broadcast(db, socketio)
    register_analytics_views(app, db)

    processes = []

    if process_start_gate():

        file_dir = os.path.dirname(os.path.realpath(__file__))

        # log_streamer process
        log_streamer_process = Popen(
            ["python3", "-m", "scripts.log_streamer"],
            cwd=os.path.join(file_dir, ".."),
            stderr=subprocess.STDOUT,
        )

        app.logger.info("Started log_streamer.py")
        processes.append(log_streamer_process)

    return app, socketio, processes


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
            # NOTE: this is the name of the Flask app, since we use
            # ``__name__``. Using ``__name__`` is required for the app
            # to function correctly. See:
            # https://blog.miguelgrinberg.com/post/why-do-we-pass-name-to-the-flask-class
            __name__: {
                "handlers": ["console"],
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "engineio": {
                "handlers": ["console"],
                "level": "ERROR",
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
