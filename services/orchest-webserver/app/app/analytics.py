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
    """Sends an anonymized telemetry event.

    The telemetry data is send to our self-hosted telemetry service and
    is always in the format::

        {
            "event_properties": ...  # anonymized event properties
            "derived_properties": ...  # derived from removed properties
            "app_properties": ...  # Orchest application properties
        }

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

    try:
        anonymize = _Anonymizer(event_name)
        event_data["derived_properties"] = anonymize(event_data["event_properties"])
    except ValueError:
        app.logger.error(f"Unknown how to anonymize analytics event '{event_name}'.")
        # We only want to send anonymized data.
        return False
    except RuntimeError:
        app.logger.error(
            f"Failed to anonymize analytics event data for '{event_name}'."
        )
        # We only want to send anonymized data.
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


class _Anonymizer:
    def __init__(self, event_name: str) -> None:
        """Anonymizes the event properties of the given event.

        To determine how the properties need to be anonymized, the given
        `event_name` is used.

        NOTE: `event_name` must follow the regex r'[a-z\-]+ [a-z]+'.

        Raises:
            ValueError: Doesn't know how to anonymize the given event.
        """
        self.event_name = event_name

        try:
            self._anonimization_func = getattr(
                self, event_name.replace(" ", "_").replace("-", "_")
            )
        except AttributeError:
            raise ValueError(
                f"No implementation exists to anonymize event '{event_name}'."
            )

    def __call__(self, event_properties: dict) -> dict:
        """anonymizes the given properties in place.

        Optionally returns derived properties from the anonymized
        properties, e.g. returning the number of step parameters instead
        of the actual parameter names, and indicates the property it was
        derived from. Example::

            {
                "job_definition": {
                    "parameterized_runs_count": ...
                },
            }

        where the `"parameterized_runs_count"` was derived from an
        attribute in the `"job_definition"`.

        """
        try:
            derived_properties = self._anonimization_func(event_properties)
        except Exception:
            derived_properties = None
            raise RuntimeError(
                "Unexpected error while anonimizing event data"
                f" for '{self.event_name}'."
            )

        if derived_properties is None:
            return {}
        return derived_properties

    @staticmethod
    def job_create(event_properties):
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
    def job_update(event_properties):
        job_def = event_properties["job_definition"]
        job_def.pop("strategy_json", None)

        derived_properties = {"job_definition": {}}
        derived_properties["job_definition"] = {
            "env_variables_count": len(job_def.pop("env_variables", {})),
            "parameterized_runs_count": len(job_def.pop("parameters", [])),
        }
        return derived_properties

    @staticmethod
    def session_start(event_properties):
        derived_properties = {"services": {}}
        for sname, sdef in event_properties.get("services", {}).items():
            derived_properties["services"][sname] = _anonymize_service_definition(sdef)

        return derived_properties

    @staticmethod
    def pipeline_run_start(event_properties):
        pdef = event_properties["pipeline_definition"]
        derived_properties = {
            "pipeline_definition": _anonymize_pipeline_definition(pdef),
        }
        return derived_properties

    @staticmethod
    def pipeline_save(event_properties):
        pdef = event_properties["pipeline_definition"]
        derived_properties = {
            "pipeline_definition": _anonymize_pipeline_definition(pdef),
        }
        return derived_properties

    # -----------------------------
    # Events that don't require any anonymization. However this way of
    # implementation clearly shows us all the telemetry events we
    # current support.
    # -----------------------------
    @staticmethod
    def view_load(event_properties) -> None:
        return

    @staticmethod
    def alert_show(event_properties) -> None:
        return

    @staticmethod
    def confirm_show(event_properties) -> None:
        return

    @staticmethod
    def build_request(event_properties) -> None:
        return

    @staticmethod
    def heartbeat_trigger(event_properties) -> None:
        return

    @staticmethod
    def job_cancel(event_properties) -> None:
        return

    @staticmethod
    def job_delete(event_properties) -> None:
        return

    @staticmethod
    def environment_build_start(event_properties) -> None:
        return

    @staticmethod
    def environment_build_cancel(event_properties) -> None:
        return

    @staticmethod
    def session_stop(event_properties) -> None:
        return

    @staticmethod
    def session_restart(event_properties) -> None:
        return

    @staticmethod
    def pipeline_run_cancel(event_properties) -> None:
        return


def _anonymize_service_definition(definition: dict) -> dict:
    definition.pop("command", None)
    definition.pop("entrypoint", None)
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
    for _, step in steps.items():
        step.pop("title")
        step.pop("file_path")
        step_parameters_count += len(step.pop("parameters", {}))

        env = step.get("environment")
        if env is not None:
            environments.add(env)

    derived_properties = {
        "pipeline_parameters_count": len(definition.pop("parameters", {})),
        "step_count": step_count,
        "unique_environments_count": len(environments),
        "step_parameters_count": step_parameters_count,
        "services": {},
    }

    services = definition.get("services", {})
    for sname, sdef in services.items():
        derived_properties["services"][sname] = _anonymize_service_definition(sdef)

    return derived_properties
