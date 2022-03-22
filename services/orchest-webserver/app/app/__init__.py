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
import signal
import subprocess
import sys
from logging.config import dictConfig
from pprint import pformat
from subprocess import Popen

import posthog
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request, send_from_directory
from flask_migrate import Migrate
from flask_socketio import SocketIO
from sqlalchemy_utils import create_database, database_exists

from _orchest.internals import config as _config
from _orchest.internals import errors as _errors
from _orchest.internals import utils as _utils
from app import config
from app.connections import db, ma
from app.core.scheduler import add_recurring_jobs_to_scheduler
from app.kernel_manager import populate_kernels
from app.models import Project
from app.socketio_server import register_socketio_broadcast
from app.utils import get_repo_tag
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


def create_app(to_migrate_db=False):
    """Create the Flask app and return it.

    Args:
        to_migrate_db: If True, then only initialize the db.

    Returns:
        Flask.app
    """
    signal.signal(signal.SIGTERM, lambda *args, **kwargs: sys.exit(0))
    app = Flask(__name__)
    app.config.from_object(config.CONFIG_CLASS)

    init_logging()

    # In development we want more verbose logging of every request.
    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    socketio = SocketIO(app, cors_allowed_origins="*")

    # Read directory mount based config into Flask config.
    try:
        global_orchest_config = _utils.GlobalOrchestConfig()
    except _errors.CorruptedFileError:
        app.logger.error("Failed to load global orchest config file.", exc_info=True)
    else:
        app.config.update(global_orchest_config.as_dict())
        # Initialize the config file. Needed in case the config file has
        # been deleted or if Orchest has just been installed.
        global_orchest_config.save(app)

    app.config["ORCHEST_REPO_TAG"] = get_repo_tag()

    # Create the database if it does not exist yet. Roughly equal to a
    # "CREATE DATABASE IF NOT EXISTS <db_name>" call.
    if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
        create_database(app.config["SQLALCHEMY_DATABASE_URI"])
    db.init_app(app)
    ma.init_app(app)
    # Necessary for DB migrations.
    Migrate().init_app(app, db)

    # NOTE: In this case we want to return ASAP as otherwise the DB
    # might be called (inside this function) before it is migrated.
    if to_migrate_db:
        return app, None, None

    # Add below `to_migrate_db` check, otherwise it will get logged
    # twice. Because before the app starts we first migrate.
    app.logger.info("Flask CONFIG: %s" % app.config)

    # Initialize posthog ASAP, at least before setting up the scheduler
    # but after `to_migrate_db`.
    if not app.config["TELEMETRY_DISABLED"]:
        posthog.api_key = base64.b64decode(app.config["POSTHOG_API_KEY"]).decode()
        posthog.host = app.config["POSTHOG_HOST"]

    if not _utils.is_running_from_reloader():
        with app.app_context():
            try:
                if app.config.get("TESTING", False):
                    # Do nothing.
                    # In case of tests we always want to run cleanup.
                    # Because every test will get a clean app, the same
                    # code should run for all tests.
                    pass
                else:
                    app.logger.debug("Trying to create /tmp/webserver_init_lock")
                    os.mkdir("/tmp/webserver_init_lock")
                    app.logger.info("/tmp/webserver_init_lock successfully created.")
            except FileExistsError:
                app.logger.info("/tmp/webserver_init_lock already exists.")
            else:
                jupyter_boot_lock_path = os.path.join(
                    "/userdir", _config.JUPYTER_USER_CONFIG, "lab", ".bootlock"
                )
                if os.path.exists(jupyter_boot_lock_path):
                    app.logger.info("Removing dangling jupyter boot lock.")
                    os.rmdir(jupyter_boot_lock_path)

                # On startup all kernels are refreshed. This is because
                # updating Orchest might make the kernels in the
                # userdir/.orchest/kernels directory invalid.
                projs = Project.query.all()
                for proj in projs:
                    try:
                        populate_kernels(app, db, proj.uuid)
                    except Exception as e:
                        logging.error(
                            "Failed to populate kernels on startup"
                            " for project %s: %s [%s]" % (proj.uuid, e, type(e))
                        )

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
    add_recurring_jobs_to_scheduler(scheduler, app, run_on_add=True)
    scheduler.start()

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

    if (
        os.environ.get("FLASK_ENV") != "development"
        or _utils.is_running_from_reloader()
    ):
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
