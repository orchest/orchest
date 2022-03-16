import collections
import copy
import logging
import os
import time
import uuid
from enum import Enum
from typing import Optional

import posthog
from flask.app import Flask
from posthog.request import APIError

from app.config import CONFIG_CLASS as StaticConfig
from app.utils import write_config

logger = logging.getLogger(__name__)


class AnalyticsServiceError(Exception):
    """The third party analytics service experienced an error."""

    pass


class Event(Enum):
    # NOTE: values must follow the regex r'[a-z\-]+ [a-z]+' and have
    # names like: "[noun] [verb]", e.g. "movie played" or
    # "movie updated".
    ALERT_SHOW = "alert show"
    BUILD_REQUEST = "build request"
    CONFIRM_SHOW = "confirm show"
    CRONJOB_PAUSE = "cron-job pause"
    CRONJOB_RESUME = "cron-job resume"
    ENVIRONMENT_BUILD_CANCEL = "environment-build cancel"
    ENVIRONMENT_BUILD_START = "environment-build start"
    HEARTBEAT_TRIGGER = "heartbeat trigger"
    JOB_CANCEL = "job cancel"
    JOB_CREATE = "job create"
    JOB_DELETE = "job delete"
    JOB_DUPLICATE = "job duplicate"
    JOB_PIPELINE_RUN_CANCEL = "job pipeline-run cancel"
    JOB_PIPELINE_RUN_DELETE = "job pipeline-run delete"
    JOB_UPDATE = "job update"
    JUPYTER_BUILD_START = "jupyter-build start"
    JUPYTER_BUILD_CANCEL = "jupyter-build cancel"
    PIPELINE_RUN_CANCEL = "pipeline-run cancel"
    PIPELINE_RUN_START = "pipeline-run start"
    PIPELINE_SAVE = "pipeline save"
    SESSION_RESTART = "session restart"
    SESSION_START = "session start"
    SESSION_STOP = "session stop"
    VIEW_LOAD = "view load"

    def anonymize(self, event_properties: dict) -> dict:
        """Anonymizes the given properties in place.

        To determine how the properties need to be anonymized
        `self.value` is used.

        Args:
            event_properties: The properties that describe the event.
                The exact properties that need to be anonymized are then
                cherry-picked. The passed object will be modified in
                order to anonymize it, as needed.

        Returns:
            Optionally returns derived properties from the anonymized
            properties, e.g. returning the number of step parameters
            instead of the actual parameter names, and indicates the
            property it was derived from. Example::

                {
                    "job_definition": {
                        "parameterized_runs_count": ...
                    },
                }

            where the `"parameterized_runs_count"` was derived from an
            attribute in the `"job_definition"`.

            If no properties are derived, then an empty dict is
            returned.

        """
        try:
            anonimization_func = getattr(
                _Anonymizer, self.value.replace(" ", "_").replace("-", "_")
            )
        except AttributeError:
            # No need to anonymize the event.
            logger.debug(f"Analytics event '{self}' does not need anonymization.")
            return {}

        try:
            return anonimization_func(event_properties)
        except Exception:
            raise RuntimeError(
                f"Unexpected error while anonimizing event data for '{self}'."
            )


# NOTE: You might actually want to use the concurrent safe wrapper
# `Scheduler.handle_telemetry_heartbeat_signal` in ../core/scheduler.py
# instead.
def send_heartbeat_signal(app: Flask) -> None:
    """Sends a heartbeat signal to the telemetry service.

    A user is considered to be active if the user has triggered any
    webserver logs in the last half of the `TELEMETRY_INTERVAL`.

    """
    # Value of None indicates that the user's activity could not be
    # determined.
    active = None
    try:
        t = os.path.getmtime(app.config["WEBSERVER_LOGS"])
    except OSError:
        app.logger.error(
            "Analytics heartbeat failed to identify whether the user is active.",
            exc_info=True,
        )
    else:
        diff_minutes = (time.time() - t) / 60
        active = diff_minutes < (app.config["TELEMETRY_INTERVAL"] * 0.5)

    send_event(app, Event.HEARTBEAT_TRIGGER, {"active": active})
    app.logger.debug(f"Successfully sent analytics event '{Event.HEARTBEAT_TRIGGER}'.")


def send_event(
    app: Flask, event: Event, event_properties: Optional[dict] = None
) -> bool:
    """Sends an anonymized telemetry event.

    The telemetry data is send to our self-hosted telemetry service and
    is always in the format::

        {
            "event_properties": ...  # anonymized event properties
            "derived_properties": ...  # derived from removed properties
            "app_properties": ...  # Orchest application properties
            "system_properties": ...  # System Properties, e.g. OS type.
        }

    Args:
        app: The Flask application that received the event.
        event: The event to send.
        event_properties: Any information that describes the event. This
            information will be anonymized and sent to the telemetry
            service.

    Returns:
        True if the event (including its information) was successfully
        sent to the telemetry service. False otherwise.

    """
    if app.config["TELEMETRY_DISABLED"]:
        return False

    if event_properties is None:
        event_data = {"event_properties": {}}
    else:
        event_data = {"event_properties": copy.deepcopy(event_properties)}

    try:
        event_data["derived_properties"] = event.anonymize(
            event_data["event_properties"]
        )
    except RuntimeError:
        app.logger.error(
            f"Failed to anonymize analytics event data for '{event}'.",
            exc_info=True,
        )
        # We only want to send anonymized data.
        return False

    _add_app_properties(event_data, app)
    _add_system_properties(event_data)

    telemetry_uuid = _get_telemetry_uuid(app)
    try:
        _send_event(telemetry_uuid, event.value, event_data)
    except AnalyticsServiceError:
        app.logger.error(f"Failed to send analytics event '{event}'.", exc_info=True)
        return False
    else:
        app.logger.debug(f"Successfully sent analytics event '{event}'.")
        return True


def _send_event(telemetry_uuid: str, event_name: str, event_data: dict) -> None:
    try:
        posthog.capture(telemetry_uuid, event_name, event_data)
    except APIError:
        raise AnalyticsServiceError(
            "PostHog experienced an error while capturing the event."
        )


def _add_app_properties(data: dict, app: Flask) -> None:
    data["app_properties"] = {
        "orchest_version": app.config.get("ORCHEST_REPO_TAG"),
        "dev": StaticConfig.FLASK_ENV == "development",
        "cloud": StaticConfig.CLOUD,
        "max_interactive_runs_parallelism": app.config.get(
            "MAX_INTERACTIVE_RUNS_PARALLELISM"
        ),
        "max_job_runs_parallelism": app.config.get("MAX_JOB_RUNS_PARALLELISM"),
    }


def _add_system_properties(data: dict) -> None:
    data["system_properties"] = {
        "host_os": os.environ.get("HOST_OS"),
        "gpu_enabled_instance": StaticConfig.GPU_ENABLED_INSTANCE,
    }


def _get_telemetry_uuid(app: Flask) -> str:
    telemetry_uuid = app.config.get("TELEMETRY_UUID")

    if telemetry_uuid is None:
        telemetry_uuid = str(uuid.uuid4())
        write_config(app, "TELEMETRY_UUID", telemetry_uuid)

    return telemetry_uuid


class _Anonymizer:
    """Anonymizes the event properties of the given event.

    !Note: if you are implementing a function to anonymize some event
    properties be aware that you are in charge of modifying the passed
    `event_properties` object to anonymize it.
    """

    @staticmethod
    def job_create(event_properties: dict) -> dict:
        job_def = event_properties["job_definition"]
        job_def.pop("name", None)
        job_def.pop("pipeline_name", None)
        # TODO: Could also send an anonymized version of the pipeline
        # definition.
        job_def.pop("pipeline_definition", None)
        job_def["pipeline_run_spec"].pop("run_config", None)

        derived_properties = {"job_definition": {}}
        derived_properties["job_definition"] = {
            "parameterized_runs_count": len(job_def.pop("parameters", [])),
        }
        return derived_properties

    @staticmethod
    def job_duplicate(event_properties: dict) -> dict:
        return _Anonymizer.job_create(event_properties)

    @staticmethod
    def job_update(event_properties: dict) -> dict:
        job_def = event_properties["job_definition"]
        job_def.pop("strategy_json", None)

        derived_properties = {"job_definition": {}}
        derived_properties["job_definition"] = {
            "env_variables_count": len(job_def.pop("env_variables", {})),
            "parameterized_runs_count": len(job_def.pop("parameters", [])),
        }
        return derived_properties

    @staticmethod
    def session_start(event_properties: dict) -> dict:
        derived_properties = {"services": {}}
        for sname, sdef in event_properties.get("services", {}).items():
            derived_properties["services"][sname] = _anonymize_service_definition(sdef)

        return derived_properties

    @staticmethod
    def pipeline_run_start(event_properties: dict) -> dict:
        pdef = event_properties["pipeline_definition"]
        derived_properties = {
            "pipeline_definition": _anonymize_pipeline_definition(pdef),
        }
        return derived_properties

    @staticmethod
    def pipeline_save(event_properties: dict) -> dict:
        pdef = event_properties["pipeline_definition"]
        derived_properties = {
            "pipeline_definition": _anonymize_pipeline_definition(pdef),
        }
        return derived_properties

    @staticmethod
    def environment_image_build_start(event_properties: dict) -> dict:
        base_image = event_properties.pop("base_image", None)
        derived_properties = {}
        if isinstance(base_image, str):
            derived_properties["uses_orchest_base_image"] = base_image.startswith(
                "orchest/"
            )
        return derived_properties


def _anonymize_service_definition(definition: dict) -> dict:
    definition.pop("command", None)
    definition.pop("args", None)
    definition.pop("env_variables", None)
    definition.pop("env_variables_inherit", None)

    derived_properties = {
        "binds_count": len(definition.pop("binds", {})),
    }
    return derived_properties


def _anonymize_pipeline_definition(definition: dict) -> dict:
    """Anonymizes the given pipeline definition.

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
    definition.pop("name", None)

    steps = definition.get("steps", {})
    step_count = len(steps)

    environments = set()
    step_parameters_count = 0
    ext_count = collections.defaultdict(int)
    for _, step in steps.items():
        step.pop("title")

        # Remove file path and count extension. This way we learn what
        # file type is primarily used.
        _, file_ext = os.path.splitext(step.pop("file_path"))
        ext_count[file_ext] += 1

        step_parameters_count += len(step.pop("parameters", {}))

        # NOTE: a step with no defined environments will have a step
        # equal to "".
        env = step.get("environment", "")
        if len(env) > 0:
            environments.add(env)

    derived_properties = {
        "pipeline_parameters_count": len(definition.pop("parameters", {})),
        "step_count": step_count,
        "unique_environments_count": len(environments),
        "step_parameters_count": step_parameters_count,
        "step_file_extension_count": ext_count,
        "services": {},
    }

    services = definition.get("services", {})
    for sname, sdef in services.items():
        derived_properties["services"][sname] = _anonymize_service_definition(sdef)

    return derived_properties
