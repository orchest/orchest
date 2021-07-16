import copy
import os
import time
import uuid
from typing import Optional

import posthog
from flask.app import Flask
from posthog.request import APIError

from app.config import CONFIG_CLASS as StaticConfig
from app.utils import write_config


class AnalyticsServiceError(Exception):
    """The third party analytics service experienced an error."""

    pass


def send_heartbeat_signal(app: Flask) -> None:
    """Sends a heartbeat signal to the telemetry service."""
    # A user is considered to be active if the user has triggered any
    # webserver logs in the last half of the `TELEMETRY_INTERVAL`.
    active = None
    try:
        t = os.path.getmtime(app.config["WEBSERVER_LOGS"])
    except OSError as e:
        app.logger.error(
            "Analytics heartbeat failed to identify whether the user is active."
        )
        app.logger.debug("Exception while reading request log recency %s" % e)
    else:
        diff_minutes = (time.time() - t) / 60
        active = diff_minutes < (app.config["TELEMETRY_INTERVAL"] * 0.5)

    # Value of None indicates that the user's activity could not be
    # determined.
    event_properties = {"active": active}
    send_event(app, "heartbeat trigger", event_properties)


def send_event(
    app: Flask, event_name: str, event_properties: Optional[dict] = None
) -> bool:
    """Sends an anonimized telemetry event.

    The telemetry data is send to our self-hosted telemetry service.

    Args:
        app: The Flask application that received the event.
        event_name: The name of the event. Events should be named like:
            "[noun] [verb]", such as "movie played" or "movie updated".
            Regex for noun: [a-z\-]+, e.g. "pipeline-run".
        event_properties: Any information that describes the event. This
            information will be anonimzed and send to the telemetry
            service.

    Returns:
        True if the event (including its information) was successfully
        send to the telemetry service. False otherwise.

    """
    if app.config["TELEMETRY_DISABLED"]:
        return False

    if event_properties is None:
        event_data = {"event_properties": {}}
    else:
        event_data = {"event_properties": copy.deepcopy(event_properties)}

    anonimize = _Anonimizer(event_name)
    try:
        anonimize(event_data["event_properties"])
    except ValueError as e:
        app.logger.error(f"Failed to anonimize analytics event '{event_name}': {e}.")

        # We only want to send anonimized data.
        return False

    _add_app_properties(event_data, app)

    telemetry_uuid = _get_telemetry_uuid(app)
    try:
        _send_event(telemetry_uuid, event_name, event_data)
    except AnalyticsServiceError as e:
        app.logger.error(f"Failed to send analytics event '{event_name}': {e}.")
        return False
    else:
        app.logger.debug(f"Successfully sent analytics event '{event_name}'.")
        return True


def _send_event(telemetry_uuid: str, event_name: str, event_data: dict) -> None:
    try:
        posthog.capture(telemetry_uuid, event_name, event_data)
    except APIError as e:
        raise AnalyticsServiceError(
            f"PostHog experienced an error while capturing the event: {e}."
        )


def _add_app_properties(data: dict, app: Flask) -> None:
    data["app_properties"] = {
        "orchest_version": app.config.get("ORCHEST_REPO_TAG"),
        "dev": StaticConfig.FLASK_ENV == "development",
        "cloud": StaticConfig.CLOUD,
    }


def _get_telemetry_uuid(app: Flask) -> str:
    telemetry_uuid = app.config.get("TELEMETRY_UUID")

    if telemetry_uuid is None:
        telemetry_uuid = str(uuid.uuid4())
        write_config(app, "TELEMETRY_UUID", telemetry_uuid)

    return telemetry_uuid


class _Anonimizer:
    def __init__(self, event_name: str) -> None:
        """Anonimizes the event properties of the given event.

        To determine how the properties need to be anonimized, the given
        `event_name` is used.

        NOTE: `event_name` must follow the regex r'[a-z\-]+ [a-z]+'.

        Raises:
            ValueError: Doesn't know how to anonimize the given event.
        """
        self.event_name = event_name

        try:
            self._anonimization_func = getattr(
                self, event_name.replace(" ", "_").replace("-", "_")
            )
        except AttributeError:
            raise ValueError(
                f"No implementation exists to anonimize event '{event_name}'."
            )

    def __call__(self, event_properties: dict) -> None:
        return self._anonimization_func(event_properties)

    @staticmethod
    def pipeline_save(event_properties):
        pass

    # --- Events that don't require any anonimization ---
    @staticmethod
    def view_load(event_properties):
        return event_properties

    @staticmethod
    def alert_show(event_properties):
        return event_properties

    @staticmethod
    def confirm_show(event_properties):
        return event_properties

    @staticmethod
    def build_request(event_properties):
        return event_properties

    @staticmethod
    def heartbeat_trigger(event_properties):
        return event_properties


##################################################

# Analytics related functions
def send_job_create(app, job):
    # Anonymize .
    job = copy.deepcopy(job)
    job.pop("name", None)
    job.pop("pipeline_name", None)
    job.pop("pipeline_definition", None)
    job["pipeline_run_spec"].pop("run_config")
    job_parameterized_runs_count = len(job.pop("parameters", []))

    props = {
        "definition": job,
        "parameterized_runs_count": job_parameterized_runs_count,
    }
    send_event(app, "job create", props)


def send_job_update(app, job_uuid, update_payload):
    # Anonymize.
    up = copy.deepcopy(update_payload)
    env_variables_count = len(up.pop("env_variables", {}))
    parameterized_runs_count = len(up.pop("parameters", []))
    # Redundant info.
    up.pop("strategy_json", {})

    props = {
        "uuid": job_uuid,
        # So that we can distinguish between jobs to be run immediately,
        # one time scheduled jobs, cron jobs.
        "definition": up,
        "env_variables_count": env_variables_count,
        "parameterized_runs_count": parameterized_runs_count,
    }
    send_event(app, "job update", props)


def send_job_cancel(app, job_uuid):
    props = {"uuid": job_uuid}
    send_event(app, "job cancel", props)


def send_job_delete(app, job_uuid):
    props = {"uuid": job_uuid}
    send_event(app, "job delete", props)


def send_env_build_start(app, environment_build_request):
    # Anonymize.
    req = copy.deepcopy(environment_build_request)
    props = {"uuid": req["environment_uuid"], "project_uuid": req["project_uuid"]}
    send_event(app, "environment-build start", props)


def send_env_build_cancel(app, uuid):
    props = {"uuid": uuid}
    send_event(app, "environment-build cancel", props)


def anonymize_service(service):
    service = copy.deepcopy(service)
    service.pop("command", None)
    service.pop("entrypoint", None)
    service.pop("env_variables", None)
    service.pop("env_variables_inherit", None)
    binds = service.pop("binds", {})
    service["binds_count"] = len(binds)
    return service


def send_anonymized_pipeline_definition(app, pipeline):
    """Sends anonymized pings of an anonymized pipeline definition.

    We send the anonymized pipeline definition to understand the
    typical structure of pipelines created in Orchest. This teaches how
    to further improve Orchest's core features.

    What we track and why. Additional metrics are constructed of the
    removed fields:
        * step_count: The number of steps the pipeline contains. This
          teaches us how large typical pipelines can get.
        * step_parameters_count: The cumsum of the number of parameters
          of all steps. For analysis of the parameters usability.
        * pipeline_parameters_count: The sum of the number of parameters
          at the pipeline level. For analysis of the parameters
          usability.
        * environment_count: Number of unique environments used. Teaches
          us whether users build different environments for every step
          or just use one environment.
        * definition: An anonymized version of the pipeline definition.
          This way we can later extract new metrics.

    """
    # Make a copy so that we can remove potentially sensitive fields.
    pipeline = copy.deepcopy(pipeline)

    # Statistics construction.
    pipeline.pop("name")
    pipeline_parameters_count = len(pipeline.pop("parameters", {}))

    steps = pipeline.get("steps", {})
    step_count = len(steps)

    environments = set()
    step_parameters_count = 0
    for _, step in steps.items():
        step.pop("title")
        step.pop("file_path")
        step_parameters_count += len(step.pop("parameters", {}))

        env = step.get("environment", "")
        if len(env):
            environments.add(env)

    services = pipeline.get("services", {})
    for sname, sdef in list(services.items()):
        services[sname] = anonymize_service(sdef)

    send_event(
        app,
        "pipeline save",
        {
            "step_count": step_count,
            "step_parameters_count": step_parameters_count,
            "pipeline_parameters_count": pipeline_parameters_count,
            "environment_count": len(environments),
            "definition": pipeline,
        },
    )


def send_pipeline_run_start(app, pipeline_identifier, project_path, run_type):
    project_size = sum(
        d.stat().st_size for d in os.scandir(project_path) if d.is_file()
    )
    send_event(
        app,
        "pipeline_run start",
        {
            "identifier": pipeline_identifier,
            "project_size": project_size,
            "run_type": run_type,
        },
    )


def send_pipeline_run_cancel(app, pipeline_identifier, run_type):
    send_event(
        app,
        "pipeline_run cancel",
        {
            "identifier": pipeline_identifier,
            "run_type": run_type,
        },
    )


def send_session_start(app, session_config):

    services = {
        sname: anonymize_service(sdef)
        for sname, sdef in session_config.get("services", {}).items()
    }

    props = {
        "project_uuid": session_config["project_uuid"],
        "pipeline_uuid": session_config["pipeline_uuid"],
        "services": services,
    }
    send_event(app, "session start", props)


def send_session_stop(app, project_uuid, pipeline_uuid):
    props = {
        "project_uuid": project_uuid,
        "pipeline_uuid": pipeline_uuid,
    }
    send_event(app, "session stop", props)


def send_session_restart(app, project_uuid, pipeline_uuid, active_runs):
    props = {
        "project_uuid": project_uuid,
        "pipeline_uuid": pipeline_uuid,
        "active_runs": active_runs,
    }
    send_event(app, "session restart", props)
