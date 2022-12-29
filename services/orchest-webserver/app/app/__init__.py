"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""

import contextlib
import json
import logging
import os
import signal
import sys
from logging.config import dictConfig
from pprint import pformat

import requests
import werkzeug
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO
from sqlalchemy_utils import create_database, database_exists
from werkzeug.utils import safe_join

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from app import config
from app.connections import db, ma
from app.core.scheduler import add_recurring_jobs_to_scheduler
from app.kernel_manager import populate_kernels
from app.models import Project
from app.socketio_server import register_socketio_broadcast
from app.views.analytics import register_analytics_views
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

    # Force threading async_mode in non-development mode
    socketio_kwargs = {}
    if os.getenv("FLASK_ENV") != "development":
        socketio_kwargs["async_mode"] = "threading"

    socketio = SocketIO(app, cors_allowed_origins="*", **socketio_kwargs)

    if not to_migrate_db:
        orchest_config = requests.get(
            f"http://{config.CONFIG_CLASS.ORCHEST_API_ADDRESS}/api/ctl/orchest-settings"
        ).json()
        app.config.update(orchest_config)

    # Create the database if it does not exist yet. Roughly equal to a
    # "CREATE DATABASE IF NOT EXISTS <db_name>" call.
    if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
        create_database(app.config["SQLALCHEMY_DATABASE_URI"])
    db.init_app(app)
    ma.init_app(app)

    # NOTE: In this case we want to return ASAP as otherwise the DB
    # might be called (inside this function) before it is migrated.
    if to_migrate_db:
        return app, None, None

    # Add below `to_migrate_db` check, otherwise it will get logged
    # twice. Because before the app starts we first migrate.
    app.logger.info("Flask CONFIG: %s" % app.config)

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
            "misfire_grace_time": 2**31,
            "coalesce": False,
            # So that the same job can be in the queue an infinite
            # amount of times, e.g. for concurrent requests issuing the
            # same tasks.
            "max_instances": 2**31,
        }
    )
    app.config["SCHEDULER"] = scheduler
    add_recurring_jobs_to_scheduler(scheduler, app, run_on_add=True)
    scheduler.start()

    # static file serving
    @app.route("/", defaults={"path": ""}, methods=["GET"])
    @app.route("/<path:path>", methods=["GET"])
    def index(path):
        file_path = safe_join(app.config["STATIC_DIR"], path)
        if os.path.isfile(file_path):
            return send_from_directory(app.config["STATIC_DIR"], path)
        else:
            return send_from_directory(
                app.config["STATIC_DIR"], "index.html", max_age=0
            )

    register_views(app, db)
    register_orchest_api_views(app, db)
    register_socketio_broadcast(socketio)
    register_analytics_views(app, db)

    return app, socketio, []


def init_logging():
    dictConfig(config.CONFIG_CLASS.LOGGING_CONFIG)


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
