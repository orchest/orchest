import logging
import uuid
import requests
from app.utils import write_config

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
            "user_uuid": str(telemetry_uuid)
        }, timeout=1)
    except Exception as e:
        logging.warning("Exception while sending telemetry request %s" % e)