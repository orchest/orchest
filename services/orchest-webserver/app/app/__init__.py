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

from flask import Flask, send_from_directory
from flask_socketio import SocketIO
from app.config import CONFIG_CLASS
from apscheduler.schedulers.background import BackgroundScheduler
from app.analytics import analytics_ping
from subprocess import Popen
from app.views import register_views
from app.socketio_server import register_socketio_broadcast
from app.models import DataSource
from app.connections import db, ma
from app.utils import get_user_conf


def initialize_default_datasources(db, app):
    # pre-populate the datasources
    datasource_names = [datasource.name for datasource in DataSource.query.all()]

    for datasource in app.config['DEFAULT_DATASOURCES']:
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

    logging.info("Flask CONFIG: %s" % app.config)

    db.init_app(app)
    ma.init_app(app)

    # according to SQLAlchemy will only create tables if they do not exist
    with app.app_context():
        db.create_all()

        initialize_default_datasources(db, app)


    # static file serving
    @app.route("/public/<path:path>")
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)
    register_socketio_broadcast(db, socketio)

    if (
        "TELEMETRY_DISABLED" not in app.config
        and os.environ.get("FLASK_ENV") != "development"
    ):
        # create thread for analytics
        scheduler = BackgroundScheduler()

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
