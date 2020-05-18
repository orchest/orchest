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
import uuid

db = SQLAlchemy()

from app.views import register_views


def write_config(app, key, value):

    try:
        conf_json_path = "/config/config.json"

        with open(conf_json_path, 'r') as f:
            conf_data = json.load(f)
            
            conf_data[key] = value
            
            app.config.update(conf_data)

            try:
                json.dump(conf_data, conf_json_path)
            except Exception as e:
                print(e)
    except Exception as e:
        print(e)


def analytics_ping(app):
    try:
        logging.info("Sending TELEMETRY ping.")

        telemetry_uuid = ""

        # get UUID if it exists
        if "TELEMETRY_UUID" in app.config:
            telemetry_uuid = app.config["TELEMETRY_UUID"]
        else:
            telemetry_uuid = uuid.uuid4()
            write_config(app, "TELEMETRY_UUID", telemetry_uuid)

        requests.post("https://analytics.orchest.io", json={
            "user_uuid": telemetry_uuid
        }, timeout=1)
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


    if "TELEMETRY_DISABLED" not in app.config:
        # create thread for analytics
        scheduler = BackgroundScheduler()
        
        # send a ping now
        analytics_ping(app)
        
        # and every 15 minutes
        scheduler.add_job(analytics_ping, 'interval', minutes=15, args=[app])
        scheduler.start()


    return app
