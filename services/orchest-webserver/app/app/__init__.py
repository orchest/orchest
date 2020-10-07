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

from flask import Flask, send_from_directory
from flask_socketio import SocketIO
from app.config import CONFIG_CLASS
from apscheduler.schedulers.background import BackgroundScheduler
from app.analytics import analytics_ping
from subprocess import Popen
from app.views import register_views
from app.build_commits import register_build_views
from app.models import Image, DataSource
from app.connections import db
from app.utils import get_user_conf
from app.kernel_manager import populate_kernels
from _orchest.internals import config as _config


def initialize_default_images(db):
    # pre-populate the base images
    image_names = [image.name for image in Image.query.all()]

    for image in _config.DEFAULT_BASE_IMAGES:
        if image["name"] not in image_names:
            im = Image(name=image["name"], language=image["language"])
            db.session.add(im)
            db.session.commit()


def initialize_default_datasources(db, app):
    # pre-populate the datasources
    datasource_names = [datasource.name for datasource in DataSource.query.all()]

    for datasource in _config.DEFAULT_DATASOURCES:
        if datasource["name"] not in datasource_names:

            connection_details = datasource["connection_details"]
            
            # subtitute $HOST_USER_DIR in absolute_host_path
            if 'absolute_host_path' in connection_details:
                if '$HOST_USER_DIR' in connection_details['absolute_host_path']:
                    absolute_host_path = connection_details['absolute_host_path']
                    connection_details['absolute_host_path'] = absolute_host_path.replace(
                        '$HOST_USER_DIR', 
                        app.config["HOST_USER_DIR"]
                    )

            ds = DataSource(
                name=datasource["name"], 
                connection_details=connection_details, 
                source_type=datasource["source_type"])

            db.session.add(ds)
            db.session.commit()

 
def process_start_gate():
    # When Flask is running in dev mode, only start processes once the main
    # process is running in 'reloading' mode. Signified by
    # WERKZEUG_RUN_MAIN=true.

    if os.environ.get("FLASK_ENV") != "development":
        return True
    elif os.environ.get("WERKZEUG_RUN_MAIN") == 'true':
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

    # read directory mount based config into Flask config
    try:
        conf_data = get_user_conf()
        app.config.update(conf_data)
    except Exception as e:
        logging.warning("Failed to load config.json")

    logging.info("Flask CONFIG: %s" % app.config)

    db.init_app(app)

    # according to SQLAlchemy will only create tables if they do not exist
    with app.app_context():
        db.create_all()

        initialize_default_images(db)
        initialize_default_datasources(db, app)

        logging.info("Initializing kernels")
        populate_kernels(app, db)


    # static file serving
    @app.route('/public/<path:path>')
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)
    register_build_views(app, db, socketio)

    if "TELEMETRY_DISABLED" not in app.config and os.environ.get("FLASK_ENV") != "development":
        # create thread for analytics
        scheduler = BackgroundScheduler()
        
        # send a ping now
        analytics_ping(app)
        
        # and every 15 minutes
        scheduler.add_job(analytics_ping, 'interval', minutes=app.config["TELEMETRY_INTERVAL"], args=[app])
        scheduler.start()

    
    # Start file_permission_watcher in another process
    # TODO: reconsider file permission approach
    processes = []

    if process_start_gate():
        
        file_dir = os.path.dirname(os.path.realpath(__file__)) 

        # file permission process
        permission_process = Popen(
            ["python3", "-m", "scripts.file_permission_watcher", app.config["USER_DIR"]], cwd=os.path.join(file_dir, "..")
        )
        logging.info("Started file_permission_watcher.py")
        processes.append(permission_process)

        # docker builder process
        docker_builder_process = Popen(
            ["python3", "-m", "scripts.docker_builder", app.config["USER_DIR"]], cwd=os.path.join(file_dir, "..")
        )
        logging.info("Started docker_builder.py")
        processes.append(docker_builder_process)
    
    return app, socketio, processes

    
    
