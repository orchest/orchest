"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""

import base64
import contextlib
import logging
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

from _orchest.internals import config as _config
from _orchest.internals import errors as _errors
from _orchest.internals import utils as _utils
from app import analytics, config
from app.connections import db, ma
from app.kernel_manager import populate_kernels
from app.models import Project
from app.socketio_server import register_socketio_broadcast
from app.utils import fetch_orchest_examples_json_to_disk, get_repo_tag
from app.views.analytics import register_analytics_views
from app.views.background_tasks import register_background_tasks_view
from app.views.orchest_api import register_orchest_api_views
from app.views.views import register_views


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
    app.config.from_object(config.CONFIG_CLASS)

    init_logging()

    socketio = SocketIO(app, cors_allowed_origins="*")

    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    # read directory mount based config into Flask config
    try:
        global_user_config = _utils.GlobalOrchestConfig()
    except _errors.CorruptedFileError:
        app.logger.error("Failed to load global orchest config file.", exc_info=True)
    else:
        global_user_config.save(app)

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

        # Alembic does not support calling upgrade() concurrently
        if not _utils.is_werkzeug_parent():
            # Upgrade to the latest revision. This also takes care of
            # bringing an "empty" db (no tables) on par.
            try:
                upgrade()
            except Exception as e:
                logging.error("Failed to run upgrade() %s [%s]" % (e, type(e)))

            # On startup all kernels are freshed. This is because
            # updating Orchest might make the kernels in the
            # userdir/.orchest/kernels directory invalid.
            projs = Project.query.all()
            for proj in projs:
                try:
                    populate_kernels(app, db, proj.uuid)
                except Exception as e:
                    logging.error(
                        "Failed to populate kernels on startup for project %s: %s [%s]"
                        % (proj.uuid, e, type(e))
                    )

        # To avoid multiple removals in case of a flask --reload, so
        # that this code runs once per container.
        try:
            os.mkdir("/tmp/jupyter_lock_removed")
            lock_path = os.path.join(
                "/userdir", _config.JUPYTER_USER_CONFIG, "lab", ".bootlock"
            )
            if os.path.exists(lock_path):
                app.logger.info("Removing dangling jupyter boot lock.")
                os.rmdir(lock_path)

        except FileExistsError:
            app.logger.info(
                "/tmp/jupyter_lock_removed exists. " " Not removing the lock again."
            )

    # Telemetry
    if not app.config["TELEMETRY_DISABLED"]:
        # initialize posthog
        posthog.api_key = base64.b64decode(app.config["POSTHOG_API_KEY"]).decode()
        posthog.host = app.config["POSTHOG_HOST"]

        # send a ping now
        analytics.send_heartbeat_signal(app)

        # and every 15 minutes
        scheduler.add_job(
            analytics.send_heartbeat_signal,
            "interval",
            minutes=app.config["TELEMETRY_INTERVAL"],
            args=[app],
        )

    if app.config["POLL_ORCHEST_EXAMPLES_JSON"]:
        # Fetch now.
        fetch_orchest_examples_json_to_disk(app)

        # And every hour.
        scheduler.add_job(
            fetch_orchest_examples_json_to_disk,
            "interval",
            minutes=app.config["ORCHEST_EXAMPLES_JSON_POLL_INTERVAL"],
            args=[app],
        )

    # static file serving
    @app.route("/", defaults={"path": ""}, methods=["GET"])
    @app.route("/<path:path>", methods=["GET"])
    def index(path):
        file_path = os.path.join(app.config["STATIC_DIR"], path)
        if os.path.isfile(file_path):
            return send_from_directory(app.config["STATIC_DIR"], path)
        else:
            return send_from_directory(
                app.config["STATIC_DIR"], "index.html", cache_timeout=0
            )

    register_views(app, db)
    register_orchest_api_views(app, db)
    register_background_tasks_view(app, db)
    register_socketio_broadcast(socketio)
    register_analytics_views(app, db)

    processes = []

    if not _utils.is_werkzeug_parent():

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
    dictConfig(config.CONFIG_CLASS.LOGGING_CONFIG)


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
