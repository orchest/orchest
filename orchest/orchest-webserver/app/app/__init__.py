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

from flask import Flask, send_from_directory
from app.config import CONFIG_CLASS
from apscheduler.schedulers.background import BackgroundScheduler
from app.analytics import analytics_ping
from subprocess import Popen
from app.views import register_views
from app.connections import db
from app.utils import get_user_conf


def create_app():

    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

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

    # static file serving
    @app.route('/public/<path:path>')
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)


    if "TELEMETRY_DISABLED" not in app.config:
        # create thread for analytics
        scheduler = BackgroundScheduler()
        
        # send a ping now
        analytics_ping(app)
        
        # and every 15 minutes
        scheduler.add_job(analytics_ping, 'interval', minutes=app.config["TELEMETRY_INTERVAL"], args=[app])
        scheduler.start()

    
    # Start threaded file_permission_watcher
    # TODO: reconsider file permission approach
    # Note: process is never cleaned up, this is permissible because it's only
    # executed inside a container.
    
    watcher_file = "/tmp/file_permission_watcher_active" 

    # guarantee no two python file permission watchers are started
    if not os.path.isfile(watcher_file):
        with open(watcher_file, "w") as file:
            file.write("1")
        
        file_dir = os.path.dirname(os.path.realpath(__file__))
        permission_process = Popen(
            [os.path.join(file_dir, "scripts", "file_permission_watcher.py"), app.config["USER_DIR"]]
        )

        logging.info("Started file_permission_watcher.py")

    
    return app
