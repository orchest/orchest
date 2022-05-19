import base64
import collections
import copy
import logging
import os
from enum import Enum
from typing import Optional

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
    JOB_DUPLICATED = "job:duplicated"
    PIPELINE_SAVED = "pipeline:saved"

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
        anonymization_func = _ANONYMIZATION_MAPPINGS.get(self)
        if anonymization_func is None:
            logger.debug(f"Analytics event '{self}' does not need anonymization.")
            return {}

        try:
            return anonymization_func(event_properties)
        except Exception:
            raise RuntimeError(
                f"Unexpected error while anonymizing event data for '{self}'."
            )


_posthog_initialized = False


def _initialize_posthog() -> None:
    logger.info("Initializing posthog")
    posthog.api_key = base64.b64decode(_config.POSTHOG_API_KEY).decode()
    posthog.host = _config.POSTHOG_HOST
    global _posthog_initialized
    _posthog_initialized = True


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
        app: The Flask application that received the event. The app is
            expected to be have been initialized and to contain the
            following: TELEMETRY_UUID, MAX_JOB_RUNS_PARALLELISM,
            MAX_INTERACTIVE_RUNS_PARALLELISM. TODO: can we do away with
            passing the flask app to this module?

        event: The event to send.
        event_properties: Any information that describes the event. This
            information will be anonymized and sent to the telemetry
            service.

    Returns:
        True if the event (including its information) was successfully
        sent to the telemetry service. False otherwise.

    """
    if app.config.get("TELEMETRY_DISABLED", True):
        return False

    telemetry_uuid = app.config.get("TELEMETRY_UUID")
    if telemetry_uuid is None:
        app.logger.error("No telemetry uuid found, won't send telemetry event.")
        return False

    if not _posthog_initialized:
        _initialize_posthog()

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
    }


def _add_system_properties(data: dict) -> None:
    data["system_properties"] = {
        "host_os": os.environ.get("HOST_OS"),
        "gpu_enabled_instance": _config.GPU_ENABLED_INSTANCE,
    }


class _Anonymizer:
    """Anonymizes the event properties of the given event.

    !Note: if you are implementing a function to anonymize some event
    properties be aware that you are in charge of modifying the passed
    `event_properties` object to anonymize it. After implementing a
    function, add it to Event._ANONYMIZATION_MAPPINGS.
    """

    @staticmethod
    def project_event(event_properties: dict) -> dict:
        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        return derived_properties

    @staticmethod
    def environment_event(event_properties: dict) -> dict:
        derived_properties = _Anonymizer.project_event(event_properties)
        derived_properties["project"]["environment"] = {}
        return derived_properties

    @staticmethod
    def environment_image_build_event(event_properties: dict) -> dict:
        derived_properties = _Anonymizer.environment_event(event_properties)
        event_properties["project"]["environment"]["image_build"].pop(
            "project_path", None
        )
        derived_properties["project"]["environment"]["image_build"] = {}
        return derived_properties

    @staticmethod
    def environment_image_build_created_event(event_properties: dict) -> dict:
        derived_properties = _Anonymizer.environment_image_build_event(event_properties)
        image_build_derived_props = derived_properties["project"]["environment"][
            "image_build"
        ]

        base_image = event_properties["project"]["environment"]["image_build"].get(
            "base_image"
        )
        if isinstance(base_image, str):
            image_build_derived_props[
                "uses_orchest_base_image"
            ] = base_image.startswith("orchest/")
            # Deprecated.
            derived_properties["uses_orchest_base_image"] = image_build_derived_props[
                "uses_orchest_base_image"
            ]
        if not derived_properties.get("uses_orchest_base_image", False):
            event_properties["project"]["environment"]["image_build"].pop(
                base_image, None
            )

        return derived_properties

    @staticmethod
    def pipeline_event(event_properties: dict) -> dict:
        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        derived_properties["project"]["pipeline"] = _anonymize_pipeline_properties(
            event_properties["project"]["pipeline"]
        )
        return derived_properties

    @staticmethod
    def _deprecated_job_created(event_properties: dict) -> dict:
        """To not introduce breaking changes in the analytics schema."""

        job_def = event_properties["job_definition"]
        job_def.pop("name", None)
        job_def.pop("pipeline_name", None)
        job_def.pop("strategy_json", None)
        # TODO: Could also send an anonymized version of the pipeline
        # definition.
        job_def.pop("pipeline_definition", None)
        job_def["pipeline_run_spec"].pop("run_config", None)

        derived_properties = {"job_definition": {}}
        derived_properties["job_definition"] = {
            "parameterized_runs_count": len(job_def.pop("parameters", [])),
            "env_variables_count": len(job_def.pop("env_variables", {})),
        }
        return derived_properties

    @staticmethod
    def project_one_off_job_created_updated(event_properties: dict) -> dict:
        derived_properties = _Anonymizer.project_one_off_job(event_properties)
        deprecated_derived = _Anonymizer._deprecated_job_created(event_properties)
        derived_properties = {**deprecated_derived, **derived_properties}
        return derived_properties

    @staticmethod
    def project_cron_job_created_updated(event_properties: dict) -> dict:
        derived_properties = _Anonymizer.project_cron_job(event_properties)
        deprecated_derived = _Anonymizer._deprecated_job_created(event_properties)
        derived_properties = {**deprecated_derived, **derived_properties}
        return derived_properties

    @staticmethod
    def job_duplicated(event_properties: dict) -> dict:
        return _Anonymizer._deprecated_job_created(event_properties)

    @staticmethod
    def session_started(event_properties: dict) -> dict:
        derived_user_services = {}
        user_services = event_properties["project"]["pipeline"]["session"][
            "user_services"
        ]
        for service_name, service_def in user_services.items():
            derived_user_services[service_name] = _anonymize_service_definition(
                service_def
            )

        event_properties["project"]["pipeline"]["session"].pop("user_services")

        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        derived_properties["project"] = {
            "session": {"user_services": derived_user_services}
        }
        # To not break the analytics schema, deprecated.
        derived_properties["services"] = derived_user_services

        return derived_properties

    @staticmethod
    def interactive_pipeline_run(event_properties: dict) -> dict:
        pipeline_run = event_properties["project"]["pipeline"]["session"][
            "pipeline_run"
        ]

        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        derived_properties["project"]["pipeline"] = {
            "session": {
                "pipeline_run": _anonymize_pipeline_run_properties(pipeline_run)
            }
        }

        # To not break the analytics schema, deprecated.
        derived_properties["pipeline_definition"] = pipeline_run["pipeline_definition"]
        event_properties["run_uuid"] = pipeline_run["uuid"]
        event_properties["run_type"] = "interactive"
        event_properties["step_uuids_to_execute"] = pipeline_run["steps"]

        return derived_properties

    @staticmethod
    def pipeline_saved(event_properties: dict) -> dict:
        pdef = event_properties["pipeline_definition"]
        derived_properties = {
            "pipeline_definition": _anonymize_pipeline_definition(pdef),
        }
        return derived_properties

    @staticmethod
    def project_one_off_job(event_properties: dict) -> dict:
        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        derived_job_properties = _anonymize_one_off_job_properties(
            event_properties["project"]["job"]
        )
        derived_properties["project"]["job"] = derived_job_properties
        return derived_properties

    @staticmethod
    def project_cron_job(event_properties: dict) -> dict:
        derived_properties = {}
        derived_properties["project"] = _anonymize_project_properties(
            event_properties["project"]
        )
        derived_job_properties = _anonymize_cron_job_properties(
            event_properties["project"]["job"]
        )
        derived_properties["project"]["job"] = derived_job_properties
        return derived_properties


_ANONYMIZATION_MAPPINGS = {
    Event.CRON_JOB_CANCELLED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_CREATED: _Anonymizer.project_cron_job_created_updated,
    Event.CRON_JOB_DELETED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_FAILED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_PAUSED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_FAILED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_CANCELLED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_CREATED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_DELETED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_FAILED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_STARTED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_PIPELINE_RUN_SUCCEEDED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_STARTED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_RUN_SUCCEEDED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_STARTED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_UNPAUSED: _Anonymizer.project_cron_job,
    Event.CRON_JOB_UPDATED: _Anonymizer.project_cron_job_created_updated,
    Event.ENVIRONMENT_CREATED: _Anonymizer.environment_event,
    Event.ENVIRONMENT_DELETED: _Anonymizer.environment_event,
    Event.ENVIRONMENT_IMAGE_BUILD_CANCELLED: _Anonymizer.environment_image_build_event,
    Event.ENVIRONMENT_IMAGE_BUILD_CREATED: _Anonymizer.environment_image_build_created_event,  # noqa
    Event.ENVIRONMENT_IMAGE_BUILD_FAILED: _Anonymizer.environment_image_build_event,
    Event.ENVIRONMENT_IMAGE_BUILD_STARTED: _Anonymizer.environment_image_build_event,
    Event.ENVIRONMENT_IMAGE_BUILD_SUCCEEDED: _Anonymizer.environment_image_build_event,
    Event.INTERACTIVE_PIPELINE_RUN_CANCELLED: _Anonymizer.interactive_pipeline_run,
    Event.INTERACTIVE_PIPELINE_RUN_CREATED: _Anonymizer.interactive_pipeline_run,
    Event.INTERACTIVE_PIPELINE_RUN_FAILED: _Anonymizer.interactive_pipeline_run,
    Event.INTERACTIVE_PIPELINE_RUN_STARTED: _Anonymizer.interactive_pipeline_run,
    Event.INTERACTIVE_PIPELINE_RUN_SUCCEEDED: _Anonymizer.interactive_pipeline_run,
    Event.JOB_DUPLICATED: _Anonymizer.job_duplicated,
    Event.ONE_OFF_JOB_CANCELLED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_CREATED: _Anonymizer.project_one_off_job_created_updated,
    Event.ONE_OFF_JOB_DELETED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_FAILED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_CANCELLED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_CREATED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_DELETED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_FAILED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_STARTED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_PIPELINE_RUN_SUCCEEDED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_STARTED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_SUCCEEDED: _Anonymizer.project_one_off_job,
    Event.ONE_OFF_JOB_UPDATED: _Anonymizer.project_one_off_job_created_updated,
    Event.PIPELINE_CREATED: _Anonymizer.pipeline_event,
    Event.PIPELINE_DELETED: _Anonymizer.pipeline_event,
    Event.PIPELINE_SAVED: _Anonymizer.pipeline_saved,
    Event.PIPELINE_UPDATED: _Anonymizer.pipeline_event,
    Event.PROJECT_CREATED: _Anonymizer.project_event,
    Event.PROJECT_DELETED: _Anonymizer.project_event,
    Event.PROJECT_UPDATED: _Anonymizer.project_event,
    Event.SESSION_STARTED: _Anonymizer.session_started,
}


def _anonymize_project_properties(project: dict) -> dict:
    project.pop("name", None)
    return {}


def _anonymize_pipeline_properties(pipeline: dict) -> dict:
    pipeline.pop("name", None)
    return {}


def _anonymize_one_off_job_properties(job: dict) -> dict:
    job.pop("pipeline_name", None)
    job.pop("name", None)
    derived_properties = {}
    if "pipeline_run" in job:
        run_derived_properties = _anonymize_pipeline_run_properties(job["pipeline_run"])
        derived_properties["pipeline_run"] = run_derived_properties
    return derived_properties


def _anonymize_cron_job_properties(job: dict) -> dict:
    job.pop("pipeline_name", None)
    job.pop("name", None)
    derived_properties = {}
    if "pipeline_run" in job.get("run", {}):
        run_derived_properties = _anonymize_pipeline_run_properties(
            job["run"]["pipeline_run"]
        )
        derived_properties["run"] = {}
        derived_properties["run"]["pipeline_run"] = run_derived_properties
    return derived_properties


def _anonymize_pipeline_run_properties(pipeline_run: dict) -> dict:
    derived_properties = {}
    derived_properties["failed_steps_count"] = len(pipeline_run.pop("failed_steps", []))
    derived_params = {}
    derived_properties["parameters"] = derived_params
    for k, v in pipeline_run.pop("parameters", {}).items():
        if k == "pipeline_parameters":
            derived_params[f"{k}_count"] = len(v["parameters"])
        else:
            derived_params[f"{k}_parameters_count"] = len(v["parameters"])

    for step in pipeline_run.get("steps", []):
        step.pop("title", None)

    if "pipeline_definition" in pipeline_run:
        pipeline_run["pipeline_definition"] = _anonymize_pipeline_definition(
            pipeline_run["pipeline_definition"]
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
