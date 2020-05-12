"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from app.config import CONFIG_CLASS
from apscheduler.schedulers.background import BackgroundScheduler

import os
import logging
import json
import sys
import requests

db = SQLAlchemy()

from app.views import register_views
from app.proxy import register_proxy

def analytics_ping():
    try:
        logging.info("Sending TELEMETRY ping.")
        requests.get("https://analytics.orchest.io", timeout=1)
    except Exception as e:
        logging.warning("Exception while sending telemetry request %s" % e)


def create_app():

    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    # read directory mount based config into Flask config
    try:
        with open("/config/config.json", 'r') as f:
            conf_data = json.load(f)
            app.config.update(conf_data)
    except Exception as e:
        logging.warning("Failed to load config.json")

    logging.info("Flask CONFIG: %s" % app.config)

    db.init_app(app)
    # db.create_all()

    # static file serving
    @app.route('/public/<path:path>')
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)

    proxy = register_proxy(app)
    app.register_blueprint(proxy)

    if "TELEMETRY_DISABLED" not in app.config:
        # create thread for analytics
        scheduler = BackgroundScheduler()
        
        # send a ping now
        analytics_ping()
        
        # and every 15 minutes
        scheduler.add_job(analytics_ping, 'interval', minutes=15)
        scheduler.start()


    return app
