"""Module to send telemetry data to the telemetry back-end.

This module provides the following:
- An enumeration that represents the possible events that are sent.
- A send_event function to send telemetry events along with already
    anonymized data.
- A number of already defined anonymization functions for data which
    schema is already defined globally, i.e. across all Orchest
    services.  These functions always do the following: modify the
    passed, non already anonymized object in place to remove sensitive
    data, and construct a dictionary of derived_properties which
    constitutes the return value. If you are implementing such
    functions, follow this behaviour.

# TODO: delete this comment.
Note: this is a work in progress, later commits will shift the
anonymization logic to the callers of this module.

"""
import base64
import collections
import logging
import os
from enum import Enum
from typing import Any, Optional, TypedDict

import posthog
from flask.app import Flask
from posthog.request import APIError

from _orchest.internals import config as _config

logger = logging.getLogger(__name__)


class AnalyticsServiceError(Exception):
    """The third party analytics service experienced an error."""

    pass


class Event(Enum):

    # Sent by the FE by POSTing a json to the webserver to /analytics.
    ALERT_SHOW = "alert:shown"
    CONFIRM_SHOW = "confirm:shown"
    VIEW_LOAD = "view:loaded"

    # Sent by orchest-webserver. Try to minimize these events, in favour
    # of moving them to the orchest-api.
    HEARTBEAT_TRIGGER = "heartbeat-trigger"
    ONE_OFF_JOB_DUPLICATED = "project:one-off-job:duplicated"
    CRON_JOB_DUPLICATED = "project:cron-job:duplicated"
    PIPELINE_SAVED = "project:pipeline:saved"

    # Sent by the orchest-api.
    DEBUG_PING = "debug-ping"

    PROJECT_CREATED = "project:created"
    PROJECT_UPDATED = "project:updated"
    PROJECT_DELETED = "project:deleted"

    ENVIRONMENT_CREATED = "project:environment:created"
    ENVIRONMENT_DELETED = "project:environment:deleted"
    ENVIRONMENT_IMAGE_BUILD_CREATED = "project:environment:image-build:created"
    ENVIRONMENT_IMAGE_BUILD_STARTED = "project:environment:image-build:started"
    ENVIRONMENT_IMAGE_BUILD_CANCELLED = "project:environment:image-build:cancelled"
    ENVIRONMENT_IMAGE_BUILD_FAILED = "project:environment:image-build:failed"
    ENVIRONMENT_IMAGE_BUILD_SUCCEEDED = "project:environment:image-build:succeeded"

    PIPELINE_CREATED = "project:pipeline:created"
    PIPELINE_UPDATED = "project:pipeline:updated"
    PIPELINE_DELETED = "project:pipeline:deleted"

    JUPYTER_IMAGE_BUILD_CREATED = "jupyter:image-build:created"
    JUPYTER_IMAGE_BUILD_STARTED = "jupyter:image-build:started"
    JUPYTER_IMAGE_BUILD_CANCELLED = "jupyter:image-build:cancelled"
    JUPYTER_IMAGE_BUILD_FAILED = "jupyter:image-build:failed"
    JUPYTER_IMAGE_BUILD_SUCCEEDED = "jupyter:image-build:succeeded"

    INTERACTIVE_PIPELINE_RUN_CREATED = (
        "project:pipeline:interactive-session:pipeline-run:created"
    )
    INTERACTIVE_PIPELINE_RUN_STARTED = (
        "project:pipeline:interactive-session:pipeline-run:started"
    )
    INTERACTIVE_PIPELINE_RUN_CANCELLED = (
        "project:pipeline:interactive-session:pipeline-run:cancelled"
    )
    INTERACTIVE_PIPELINE_RUN_FAILED = (
        "project:pipeline:interactive-session:pipeline-run:failed"
    )
    INTERACTIVE_PIPELINE_RUN_SUCCEEDED = (
        "project:pipeline:interactive-session:pipeline-run:succeeded"
    )

    ONE_OFF_JOB_CREATED = "project:one-off-job:created"
    ONE_OFF_JOB_STARTED = "project:one-off-job:started"
    ONE_OFF_JOB_DELETED = "project:one-off-job:deleted"
    ONE_OFF_JOB_CANCELLED = "project:one-off-job:cancelled"
    ONE_OFF_JOB_FAILED = "project:one-off-job:failed"
    ONE_OFF_JOB_UPDATED = "project:one-off-job:updated"
    ONE_OFF_JOB_SUCCEEDED = "project:one-off-job:succeeded"

    ONE_OFF_JOB_PIPELINE_RUN_CREATED = "project:one-off-job:pipeline-run:created"
    ONE_OFF_JOB_PIPELINE_RUN_STARTED = "project:one-off-job:pipeline-run:started"
    ONE_OFF_JOB_PIPELINE_RUN_CANCELLED = "project:one-off-job:pipeline-run:cancelled"
    ONE_OFF_JOB_PIPELINE_RUN_FAILED = "project:one-off-job:pipeline-run:failed"
    ONE_OFF_JOB_PIPELINE_RUN_DELETED = "project:one-off-job:pipeline-run:deleted"
    ONE_OFF_JOB_PIPELINE_RUN_SUCCEEDED = "project:one-off-job:pipeline-run:succeeded"

    CRON_JOB_CREATED = "project:cron-job:created"
    CRON_JOB_STARTED = "project:cron-job:started"
    CRON_JOB_DELETED = "project:cron-job:deleted"
    CRON_JOB_CANCELLED = "project:cron-job:cancelled"
    CRON_JOB_FAILED = "project:cron-job:failed"
    CRON_JOB_UPDATED = "project:cron-job:updated"
    CRON_JOB_PAUSED = "project:cron-job:paused"
    CRON_JOB_UNPAUSED = "project:cron-job:unpaused"

    CRON_JOB_RUN_STARTED = "project:cron-job:run:started"
    CRON_JOB_RUN_SUCCEEDED = "project:cron-job:run:succeeded"
    CRON_JOB_RUN_FAILED = "project:cron-job:run:failed"

    CRON_JOB_RUN_PIPELINE_RUN_CREATED = "project:cron-job:run:pipeline-run:created"
    CRON_JOB_RUN_PIPELINE_RUN_STARTED = "project:cron-job:run:pipeline-run:started"
    CRON_JOB_RUN_PIPELINE_RUN_CANCELLED = "project:cron-job:run:pipeline-run:cancelled"
    CRON_JOB_RUN_PIPELINE_RUN_FAILED = "project:cron-job:run:pipeline-run:failed"
    CRON_JOB_RUN_PIPELINE_RUN_DELETED = "project:cron-job:run:pipeline-run:deleted"
    CRON_JOB_RUN_PIPELINE_RUN_SUCCEEDED = "project:cron-job:run:pipeline-run:succeeded"

    SESSION_STARTED = "project:pipeline:interactive-session:started"
    SESSION_STOPPED = "project:pipeline:interactive-session:stopped"
    SESSION_FAILED = "project:pipeline:interactive-session:failed"
    SESSION_SERVICE_RESTARTED = "project:pipeline:interactive-session:service-restarted"
    SESSION_SUCCEEDED = "project:pipeline:interactive-session:succeeded"


_posthog_initialized = False


def _initialize_posthog() -> None:
    logger.info("Initializing posthog")
    posthog.api_key = base64.b64decode(_config.POSTHOG_API_KEY).decode()
    posthog.host = _config.POSTHOG_HOST
    global _posthog_initialized
    _posthog_initialized = True


class TelemetryData(TypedDict):
    event_properties: Any
    derived_properties: Any


def send_event(
    app: Flask, event: Event, event_data: Optional[TelemetryData] = None
) -> bool:
    """Sends a telemetry event. !!! The data must already be anonymized.

    The telemetry data is sent to our self-hosted telemetry service and
    must follow the format:

        {
            "event_properties": ...  # anonymized event properties
            "derived_properties": ...  # derived from removed properties
        }

    Two entries are added to said data before being sent out:
        {
            ...,
            "app_properties": ...  # Orchest application properties
            "system_properties": ...  # System Properties, e.g. OS type.
        }


    Args:
        app: The Flask application that received the event. The app is
            expected to be have been initialized and to contain the
            following: TELEMETRY_UUID, MAX_JOB_RUNS_PARALLELISM,
            MAX_INTERACTIVE_RUNS_PARALLELISM, MAX_BUILDS_PARALLELISM.
            TODO: can we do away with passing the flask app to this
            module?
        event: The event to send.
        event_data: Information that describes the event. Must follow
            the TelemetryData schema and must already be anonymized,
            that is, anonymizing is responsibility of the caller.

    Raises:
        ValueError: If event_data doesn't have the right schema.

    Returns:
        True if the event (including its information) was successfully
        sent to the telemetry service. False otherwise.

    """
    if event_data is not None and (
        "event_properties" not in event_data
        or "derived_properties" not in event_data
        or len(event_data) != 2
    ):
        raise ValueError("event_data should be of type TelemetryData")

    if app.config.get("TELEMETRY_DISABLED", True):
        return False

    telemetry_uuid = app.config.get("TELEMETRY_UUID")
    if telemetry_uuid is None:
        app.logger.error("No telemetry uuid found, won't send telemetry event.")
        return False

    if not _posthog_initialized:
        _initialize_posthog()

    if event_data is not None:
        event_data.get("event_properties", {})["type"] = event.value

    _add_app_properties(event_data, app)
    _add_system_properties(event_data)

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
        "orchest_version": _config.ORCHEST_VERSION,
        "dev": _config.FLASK_ENV == "development",
        "cloud": _config.CLOUD,
        "max_interactive_runs_parallelism": app.config.get(
            "MAX_INTERACTIVE_RUNS_PARALLELISM"
        ),
        "max_job_runs_parallelism": app.config.get("MAX_JOB_RUNS_PARALLELISM"),
        "max_builds_parallelism": app.config.get("MAX_BUILDS_PARALLELISM"),
    }


def _add_system_properties(data: dict) -> None:
    data["system_properties"] = {
        "host_os": os.environ.get("HOST_OS"),
        "gpu_enabled_instance": _config.GPU_ENABLED_INSTANCE,
        "k8s_distro": _config.K8S_DISTRO,
    }


def anonymize_service_definition(definition: dict) -> dict:
    definition.pop("command", None)
    definition.pop("args", None)
    definition.pop("env_variables", None)
    definition.pop("env_variables_inherit", None)

    derived_properties = {
        "binds_count": len(definition.pop("binds", {})),
    }
    return derived_properties


def anonymize_pipeline_definition(definition: dict) -> dict:
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
        derived_properties["services"][sname] = anonymize_service_definition(sdef)

    return derived_properties
