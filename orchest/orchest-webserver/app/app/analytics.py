import logging
import uuid
import requests
import os
import time
from app.utils import write_config


def analytics_ping(app):
    """
    Note: telemetry can be disabled by including TELEMETRY_DISABLED in your user
    # config.json.
    """

    try:

        telemetry_uuid = ""

        # get UUID if it exists
        if "TELEMETRY_UUID" in app.config:
            telemetry_uuid = app.config["TELEMETRY_UUID"]
        else:
            telemetry_uuid = str(uuid.uuid4())
            write_config(app, "TELEMETRY_UUID", telemetry_uuid)

        data = {
            "user_uuid": telemetry_uuid,
            "active": check_active(app)
        }

        requests.post("https://analytics.orchest.io", json=data, timeout=1)

        logging.info("Sending TELEMETRY ping: %s" % data)

    except Exception as e:
        logging.warning("Exception while sending telemetry request %s" % e)


def check_active(app):
    try:
        t = os.path.getmtime(app.config["WEBSERVER_LOG"])

        diff_minutes = (time.time() - t) / 60

        return diff_minutes < app.config["TELEMETRY_INTERVAL"]
    except OSError as e:
        logging.debug("Exception while reading request log recency %s" % e)
        return False