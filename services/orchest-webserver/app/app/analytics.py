import copy
import os
import time
import uuid

import posthog
from posthog.request import APIError

from app.utils import write_config


# Analytics related functions
def send_anonymized_pipeline_definition(app, pipeline):
    """We send the anonymized pipeline definition to understand the typical
    structure of pipelines created in Orchest. This teaches how to further
    improve Orchest's core features.
    """

    # Remove potentially sensitive fields
    pipeline = copy.deepcopy(pipeline)

    # Statistics
    environments = set()
    # The step count helps us understand how large typical pipelines get.
    step_count = len(pipeline.get("steps", []))

    pipeline.pop("name", None)
    steps = pipeline.get("steps", {})

    for _, step in steps.items():
        step.pop("title", None)
        step.pop("parameters", None)
        step.pop("file_path", None)

        # Capture environments for count
        env = step.get("environment", "")
        if len(env) > 0:
            environments.add(env)

    # The environment count helps us understand how many environments are
    # typically used within a single pipeline.
    environment_count = len(environments)

    send_event(
        app,
        "pipeline save",
        {
            "step_count": step_count,
            "environment_count": environment_count,
            "definition": pipeline,
        },
    )


def send_pipeline_run(app, pipeline_identifier, project_path, run_type):
    project_size = sum(
        d.stat().st_size for d in os.scandir(project_path) if d.is_file()
    )
    send_event(
        app,
        "pipeline run",
        {
            "identifier": pipeline_identifier,
            "project_size": project_size,
            "run_type": run_type,
        },
    )


def get_telemetry_uuid(app):

    # get UUID if it exists
    if "TELEMETRY_UUID" in app.config:
        telemetry_uuid = app.config["TELEMETRY_UUID"]
    else:
        telemetry_uuid = str(uuid.uuid4())
        write_config(app, "TELEMETRY_UUID", telemetry_uuid)

    return telemetry_uuid


def send_event(app, event, properties):
    if app.config["TELEMETRY_DISABLED"]:
        return False

    try:
        telemetry_uuid = get_telemetry_uuid(app)

        if "mode" not in properties:
            properties["mode"] = os.environ.get("FLASK_ENV", "production")

        properties["orchest_version"] = app.config["ORCHEST_REPO_TAG"]

        posthog.capture(telemetry_uuid, event, properties)
        app.logger.debug(
            "Sending event[%s] to Posthog for anonymized user [%s] with properties: %s"
            % (event, telemetry_uuid, properties)
        )
        return True
    except (Exception, APIError) as e:
        app.logger.error("Could not send event through posthog %s" % e)
        return False


def analytics_ping(app):
    """
    Note: telemetry can be disabled by including TELEMETRY_DISABLED in your user
    # config.json.
    """
    try:
        properties = {"active": check_active(app)}
        send_event(app, "heartbeat trigger", properties)

    except Exception as e:
        app.logger.warning("Exception while sending telemetry request %s" % e)


def check_active(app):
    try:
        t = os.path.getmtime(app.config["WEBSERVER_LOGS"])

        diff_minutes = (time.time() - t) / 60

        return diff_minutes < (
            app.config["TELEMETRY_INTERVAL"] * 0.5
        )  # check whether user was active in last half of TELEMETRY_INTERVAL
    except OSError as e:
        app.logger.debug("Exception while reading request log recency %s" % e)
        return False
