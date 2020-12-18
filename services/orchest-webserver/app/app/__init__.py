"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""

import os
import logging
import json
import sys
import requests
import uuid
import atexit
import contextlib
import subprocess
import posthog
import base64

from flask import Flask, send_from_directory
from flask_migrate import Migrate, upgrade
from flask_socketio import SocketIO
from sqlalchemy_utils import create_database, database_exists

from app.config import CONFIG_CLASS
from apscheduler.schedulers.background import BackgroundScheduler
from app.analytics import analytics_ping
from subprocess import Popen
from app.views.core import register_views
from app.views.orchest_api import register_orchest_api_views
from app.views.background_tasks import register_background_tasks_view
from app.views.analytics import register_analytics_views
from app.socketio_server import register_socketio_broadcast
from app.models import DataSource, Environment
from app.connections import db, ma
from app.utils import get_user_conf, get_repo_tag


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
    # When Flask is running in dev mode, only start processes once the main
    # process is running in 'reloading' mode. Signified by
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
            logging.info("Killing subprocess with PID %d" % process.pid)
            process.kill()


def create_app():

    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    socketio = SocketIO(app, cors_allowed_origins="*")
    logging.getLogger("engineio").setLevel(logging.ERROR)

    # read directory mount based config into Flask config
    try:
        conf_data = get_user_conf()
        app.config.update(conf_data)
    except Exception as e:
        logging.warning("Failed to load config.json")

    app.config["ORCHEST_REPO_TAG"] = get_repo_tag()

    # create thread for non-cpu bound background tasks, e.g.
    # requests
    scheduler = BackgroundScheduler()
    app.config["SCHEDULER"] = scheduler

    logging.info("Flask CONFIG: %s" % app.config)

    # Create the database if it does not exist yet. Roughly equal to a
    # "CREATE DATABASE IF NOT EXISTS <db_name>" call.
    if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
        create_database(app.config["SQLALCHEMY_DATABASE_URI"])
    db.init_app(app)
    ma.init_app(app)
    # necessary for migration related stuff
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
        scheduler.start()

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

        # TODO: reconsider file permission approach
        # file_permission_watcher process
        permission_process = Popen(
            [
                "python3",
                "-m",
                "scripts.file_permission_watcher",
                app.config["USER_DIR"],
            ],
            cwd=os.path.join(file_dir, ".."),
            stderr=subprocess.STDOUT,
        )
        logging.info("Started file_permission_watcher.py")
        processes.append(permission_process)

        # log_streamer process
        log_streamer_process = Popen(
            ["python3", "-m", "scripts.log_streamer"],
            cwd=os.path.join(file_dir, ".."),
            stderr=subprocess.STDOUT,
        )

        logging.info("Started log_streamer.py")
        processes.append(log_streamer_process)

    return app, socketio, processes
