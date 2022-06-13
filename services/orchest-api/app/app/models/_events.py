"""Events models for the orchest-api."""
import copy
import datetime
import enum
import uuid
from typing import Tuple

from sqlalchemy import ForeignKeyConstraint, Index, case, event, func, or_
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import declared_attr, deferred

import app.models._core as _core_models
from _orchest.internals import analytics
from app.connections import db


class EventType(_core_models.BaseModel):
    """Type of events recorded by the orchest-api.

    The table has been pre-populated in the schema migration that
    created it, if you need to add more types add another schema
    migration. Migrations that have added event types:
    - services/orchest-api/app/migrations/versions/410e08270de4_.py
    - services/orchest-api/app/migrations/versions/814961a3d525_.py
    - services/orchest-api/app/migrations/versions/92dcc9963a9c_.py
    - services/orchest-api/app/migrations/versions/ad0b4cda3e50_.py
    - services/orchest-api/app/migrations/versions/849b7b154ef6_.py
    - services/orchest-api/app/migrations/versions/637920f5715f_.py
    - services/orchest-api/app/migrations/versions/2b573339900f_.py
    - services/orchest-api/app/migrations/versions/a4b1f48ddab5.py
    - services/orchest-api/app/migrations/versions/19ce7297c194_.py
    - services/orchest-api/app/migrations/versions/0eaf40410361_.py

    To add more types, add an empty revision with
    `bash scripts/migration_manager.sh orchest-api revision`, then
    add the statements to add more types to the event_types table in the
    revision, take a look at the existing migrations for that.
    """

    __tablename__ = "event_types"

    name = db.Column(db.String(100), primary_key=True)

    def __repr__(self):
        return f"<EventType: {self.name}>"


class Event(_core_models.BaseModel):
    """Events that happen in the orchest-api

    See EventType for what events are currently covered.

    When implementing an Event, i.e. subclassing this class, you have
    the option to implement: to_notification_payload (1) and
    to_telemetry_payload (2). 1 represents data that will be exposed to
    users as is, e.g. for webhooks, or on which other kind of
    notifications will be based on, e.g. emails. 2 represents data that
    will get to our analytics backend. This data *must* be anonymized,
    meaning that you, the implementor, must anonymize it.

    To be DRY, the current pattern is used across the models:
    - 1 is implemented
    - 2 is implemented by calling 1, then removing undesired entries,
      i.e.  sensitive data.
    - a class hierarchy is used, where children call 1/2 of the parent
      class to have a complete payload and to rely on the existence of
      some fields. The produced data is a nested dictionary where every
      layer (i.e. class implementing 1 or 2) relies on the previous
      layers, and incrementally adds its own data by further nesting
      of the dictionary.
    - the methods to fill in the current layer data are static to avoid
      the risk of them being overriden, i.e. to maintain correct
      behaviour.

    If you implement 1 you must also implement 2 if you have added
    any sensitive data.

    """

    __tablename__ = "events"

    # as_uuid=False to be consistent with what already happens with
    # other uuids in the db.
    uuid = db.Column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    type = db.Column(
        db.String(100),
        db.ForeignKey("event_types.name", ondelete="CASCADE"),
        index=True,
    )

    timestamp = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __mapper_args__ = {
        "polymorphic_on": case(
            [
                (
                    type.startswith("jupyter:image-build:"),
                    "jupyter_image_build_event",
                ),
                (
                    type.startswith("project:cron-job:run:pipeline-run:"),
                    "cron_job_run_pipeline_run_event",
                ),
                (
                    type.startswith("project:cron-job:run:"),
                    "cron_job_run_event",
                ),
                (type.startswith("project:cron-job:updated"), "cron_job_update_event"),
                (type.startswith("project:cron-job:"), "cron_job_event"),
                (
                    type.startswith("project:one-off-job:pipeline-run:"),
                    "one_off_job_pipeline_run_event",
                ),
                (
                    type.startswith("project:one-off-job:updated"),
                    "one_off_job_update_event",
                ),
                (type.startswith("project:one-off-job:"), "one_off_job_event"),
                (
                    or_(
                        type.startswith("project:one-off-job:"),
                        type.startswith("project:cron-job:"),
                    ),
                    "job_event",
                ),
                (
                    type.startswith(
                        "project:pipeline:interactive-session:pipeline-run:"
                    ),
                    "interactive_pipeline_run_event",
                ),
                (
                    type.startswith("project:pipeline:interactive-session:"),
                    "interactive_session_event",
                ),
                (type.startswith("project:pipeline:updated"), "pipeline_update_event"),
                (type.startswith("project:pipeline:"), "pipeline_event"),
                (type.startswith("project:updated"), "project_update_event"),
                (
                    type.startswith("project:environment:image-build:"),
                    "environment_image_build_event",
                ),
                (type.startswith("project:environment:"), "environment_event"),
                (type.startswith("project:"), "project_event"),
            ],
            else_="event",
        ),
        "polymorphic_identity": "event",
        # Load all subclass columns, see
        # https://docs.sqlalchemy.org/en/14/orm/inheritance_loading.html
        "with_polymorphic": "*",
    }

    @staticmethod
    def _current_layer_notification_data(event) -> dict:
        # Staticmethod to make sure it's not overriden accidentally.
        payload = {
            "uuid": event.uuid,
            "type": event.type,
            "timestamp": str(event.timestamp),
        }
        return payload

    @staticmethod
    def _current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        # Staticmethod to make sure it's not overriden accidentally.
        event_properties = Event._current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        return Event._current_layer_notification_data(self)

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        ev, deriv = Event._current_layer_telemetry_data(self)
        return analytics.TelemetryData(event_properties=ev, derived_properties=deriv)

    def __repr__(self):
        return f"<Event: {self.uuid}, {self.type}, {self.timestamp}>"


class ProjectEvent(Event):
    """Project events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "project_event"}

    project_uuid = db.Column(
        db.String(36), db.ForeignKey("projects.uuid", ondelete="CASCADE")
    )

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        project_payload = {"uuid": event.project_uuid, "name": None}
        proj = _core_models.Project.query.filter(
            _core_models.Project.uuid == event.project_uuid
        ).one()
        project_payload["name"] = proj.name
        return project_payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = ProjectEvent.current_layer_notification_data(event)
        event_properties.pop("name", None)
        derived_properties = {}

        if event.type in ["project:created", "project:deleted"]:
            derived_properties["projects_count"] = _core_models.Project.query.count()

        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"] = ProjectEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = ProjectEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"] = ev
        payload["derived_properties"]["project"] = der
        return payload

    def __repr__(self):
        return (
            f"<ProjectEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}>"
        )


class ProjectUpdateEvent(ProjectEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "project_update_event"}

    # Changes that the event led to, i.e. a project PUT. It's a
    # dictionary given the nature of the content and the fact that other
    # kind of events might have such a column as well.
    # Note that the event payload will contain the changes AS IS, i.e.
    # no transformation is done to the content of the column, so no
    # sensitive data should be added. The update must follow the
    # "EntityUpdate" TypedDict schema.
    @declared_attr
    def update(cls):
        return Event.__table__.c.get("update", db.Column(JSONB, nullable=True))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = event.update
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = ProjectUpdateEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"][
            "update"
        ] = ProjectUpdateEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = ProjectUpdateEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["update"] = ev
        payload["derived_properties"]["project"]["update"] = der
        return payload


class PipelineEvent(ProjectEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "pipeline_event"}

    @declared_attr
    def pipeline_uuid(cls):
        return Event.__table__.c.get("pipeline_uuid", db.Column(db.String(36)))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {"uuid": event.uuid}
        ppl = _core_models.Pipeline.query.filter(
            _core_models.Pipeline.project_uuid == event.project_uuid,
            _core_models.Pipeline.uuid == event.pipeline_uuid,
        ).one()
        payload["name"] = ppl.name
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = PipelineEvent.current_layer_notification_data(event)
        event_properties.pop("name", None)
        derived_properties = {}

        if event.type in ["project:pipeline:created", "project:pipeline:deleted"]:
            derived_properties[
                "project_pipelines_count"
            ] = _core_models.Pipeline.query.filter(
                _core_models.Pipeline.project_uuid == event.project_uuid
            ).count()
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"] = PipelineEvent.current_layer_notification_data(
            self
        )
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = PipelineEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["pipeline"] = ev
        payload["derived_properties"]["project"]["pipeline"] = der
        return payload


ForeignKeyConstraint(
    [PipelineEvent.project_uuid, PipelineEvent.pipeline_uuid],
    [_core_models.Pipeline.project_uuid, _core_models.Pipeline.uuid],
    ondelete="CASCADE",
)


class PipelineUpdateEvent(PipelineEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "pipeline_update_event"}

    # See ProjectUpdateEvent.update for info.
    @declared_attr
    def update(cls):
        return Event.__table__.c.get("update", db.Column(JSONB, nullable=True))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = event.update
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = PipelineUpdateEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"][
            "update"
        ] = PipelineUpdateEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = PipelineUpdateEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["pipeline"]["update"] = ev
        payload["derived_properties"]["project"]["pipeline"]["update"] = der
        return payload


def _prepare_step_payload(uuid: str, title: str) -> dict:
    return {
        "uuid": uuid,
        "title": title,
    }


def _prepare_interactive_run_parameters_payload(pipeline_definition: dict) -> dict:
    parameters_payload = {}
    for k, v in pipeline_definition["steps"].items():
        step_name = pipeline_definition.get("steps").get(k, {}).get("title")
        step_payload = _prepare_step_payload(k, step_name)
        parameters_payload[k] = {
            "step": step_payload,
            "parameters": v.get("parameters", {}),
        }
    parameters_payload["pipeline_parameters"] = {
        "parameters": pipeline_definition.get("parameters", {})
    }
    return parameters_payload


class InteractiveSessionEvent(PipelineEvent):

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "interactive_session_event"}

    @declared_attr
    def pipeline_uuid(cls):
        return Event.__table__.c.get("pipeline_uuid", db.Column(db.String(36)))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        return {}

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = InteractiveSessionEvent.current_layer_notification_data(
            event
        )

        # Information about user services.
        sess = _core_models.InteractiveSession.query.filter(
            _core_models.InteractiveSession.project_uuid == event.project_uuid,
            _core_models.InteractiveSession.pipeline_uuid == event.pipeline_uuid,
        ).one()
        event_properties["user_services"] = sess.user_services

        derived_properties = {}
        derived_user_services = {}
        for s_name, s_def in event_properties["user_services"].items():
            derived_user_services[s_name] = analytics.anonymize_service_definition(
                s_def
            )
        derived_properties["user_services"] = derived_user_services

        # Any active runs during a service restart?
        if event.type == "project:pipeline:interactive-session:service-restarted":
            active_runs = db.session.query(
                db.session.query(_core_models.InteractivePipelineRun)
                .filter(
                    _core_models.InteractivePipelineRun.project_uuid
                    == event.project_uuid,
                    _core_models.InteractivePipelineRun.pipeline_uuid
                    == event.pipeline_uuid,
                )
                .exists()
            ).scalar()
            event_properties["active_runs"] = active_runs

        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"][
            "session"
        ] = InteractiveSessionEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = InteractiveSessionEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["pipeline"]["session"] = ev
        payload["derived_properties"]["project"]["pipeline"]["session"] = der

        # Deprecated.
        p_ev = payload["event_properties"]
        p_ev["project_uuid"] = p_ev["project"]["uuid"]
        p_ev["pipeline_uuid"] = p_ev["project"]["pipeline"]["uuid"]
        if "deprecated" not in p_ev:
            p_ev["deprecated"] = []
        p_ev["deprecated"].extend(["project_uuid", "pipeline_uuid"])
        if "active_runs" in ev:
            p_ev["active_runs"] = ev["active_runs"]
            p_ev["deprecated"].append("active_runs")

        p_der = payload["derived_properties"]
        p_der["services"] = der["user_services"]
        if "deprecated" not in p_der:
            p_der["deprecated"] = []
        p_der["deprecated"].append("services")
        return payload


ForeignKeyConstraint(
    [InteractiveSessionEvent.project_uuid, InteractiveSessionEvent.pipeline_uuid],
    [_core_models.Pipeline.project_uuid, _core_models.Pipeline.uuid],
    ondelete="CASCADE",
)


def anonymize_pipeline_run_properties(pipeline_run: dict) -> dict:
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
        derived_properties[
            "pipeline_definition"
        ] = analytics.anonymize_pipeline_definition(pipeline_run["pipeline_definition"])
    return derived_properties


class InteractivePipelineRunEvent(InteractiveSessionEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "interactive_pipeline_run_event"}

    @declared_attr
    def pipeline_run_uuid(cls):
        return Event.__table__.c.get("pipeline_run_uuid", db.Column(db.String(36)))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        pipeline_run = _core_models.InteractivePipelineRun.query.filter(
            _core_models.InteractivePipelineRun.project_uuid == event.project_uuid,
            _core_models.InteractivePipelineRun.pipeline_uuid == event.pipeline_uuid,
            _core_models.InteractivePipelineRun.uuid == event.pipeline_run_uuid,
        ).one()

        payload = {
            "uuid": event.pipeline_run_uuid,
            "url_path": (
                f"/pipeline?project_uuid={event.project_uuid}&pipeline_uuid"
                f"={event.pipeline_uuid}"
            ),
            "steps": [],
            "parameters": _prepare_interactive_run_parameters_payload(
                pipeline_run.pipeline_definition
            ),
        }

        steps = _core_models.PipelineRunStep.query.filter(
            _core_models.PipelineRunStep.run_uuid == event.pipeline_run_uuid,
        ).all()
        failed_steps = []
        for step in steps:
            step_name = (
                pipeline_run.pipeline_definition.get("steps")
                .get(step.step_uuid, {})
                .get("title")
            )
            step_payload = _prepare_step_payload(step.step_uuid, step_name)
            payload["steps"].append(step_payload)
            if step.status == "FAILURE":
                failed_steps.append(step_payload)

        if failed_steps:
            payload["failed_steps"] = failed_steps

        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = InteractivePipelineRunEvent.current_layer_notification_data(
            event
        )

        pipeline_run = _core_models.InteractivePipelineRun.query.filter(
            _core_models.InteractivePipelineRun.project_uuid == event.project_uuid,
            _core_models.InteractivePipelineRun.pipeline_uuid == event.pipeline_uuid,
            _core_models.InteractivePipelineRun.uuid == event.pipeline_run_uuid,
        ).one()
        event_properties["pipeline_definition"] = pipeline_run.pipeline_definition
        event_properties = copy.deepcopy(event_properties)
        derived_properties = anonymize_pipeline_run_properties(event_properties)

        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"]["session"][
            "pipeline_run"
        ] = InteractivePipelineRunEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = InteractivePipelineRunEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["pipeline"]["session"][
            "pipeline_run"
        ] = ev
        payload["derived_properties"]["project"]["pipeline"]["session"][
            "pipeline_run"
        ] = der

        # Deprecated.
        p_ev = payload["event_properties"]
        p_ev["run_uuid"] = ev["uuid"]
        p_ev["run_type"] = "interactive"
        p_ev["step_uuids_to_execute"] = [step["uuid"] for step in ev["steps"]]
        if "deprecated" not in p_ev:
            p_ev["deprecated"] = []
        p_ev["deprecated"].extend(["run_uuid", "run_type", "step_uuids_to_execute"])

        p_der = payload["derived_properties"]
        p_der["pipeline_definition"] = der["pipeline_definition"]
        if "deprecated" not in p_der:
            p_der["deprecated"] = []
        p_der["deprecated"].append("pipeline_definition")

        return payload


ForeignKeyConstraint(
    [InteractivePipelineRunEvent.pipeline_run_uuid],
    [_core_models.InteractivePipelineRun.uuid],
    ondelete="CASCADE",
)


class EnvironmentEvent(ProjectEvent):

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "environment_event"}

    environment_uuid = db.Column(db.String(36), nullable=True)

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {
            "uuid": event.environment_uuid,
            "url_path": (
                f"/environment?project_uuid={event.project_uuid}&environment_uuid="
                f"{event.environment_uuid}"
            ),
        }
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = EnvironmentEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"][
            "environment"
        ] = EnvironmentEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = EnvironmentEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["environment"] = ev
        payload["derived_properties"]["project"]["environment"] = der
        return payload


ForeignKeyConstraint(
    [EnvironmentEvent.project_uuid, EnvironmentEvent.environment_uuid],
    [_core_models.Environment.project_uuid, _core_models.Environment.uuid],
    ondelete="CASCADE",
)


class EnvironmentImageBuildEvent(EnvironmentEvent):

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "environment_image_build_event"}

    image_tag = db.Column(db.Integer, nullable=True)

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {}
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = EnvironmentImageBuildEvent.current_layer_notification_data(
            event
        )
        build = _core_models.EnvironmentImageBuild.query.filter(
            _core_models.EnvironmentImageBuild.project_uuid == event.project_uuid,
            _core_models.EnvironmentImageBuild.environment_uuid
            == event.environment_uuid,
            _core_models.EnvironmentImageBuild.image_tag == event.image_tag,
        ).one()
        event_properties["image_tag"] = build.image_tag
        event_properties["requested_time"] = str(build.requested_time)
        event_properties["started_time"] = str(build.started_time)
        event_properties["finished_time"] = str(build.finished_time)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["environment"][
            "image_build"
        ] = EnvironmentImageBuildEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = EnvironmentImageBuildEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["environment"]["image_build"] = ev
        payload["derived_properties"]["project"]["environment"]["image_build"] = der

        # Deprecated.
        p_ev = payload["event_properties"]
        if "deprecated" not in p_ev:
            p_ev["deprecated"] = []
        if "project_uuid" not in p_ev:
            p_ev["project_uuid"] = p_ev["project"]["uuid"]
            p_ev["deprecated"].append("project_uuid")
        p_ev["environment_uuid"] = p_ev["project"]["environment"]["uuid"]
        p_ev["image_tag"] = p_ev["project"]["environment"]["image_build"]["image_tag"]
        p_ev["deprecated"].extend(["environment_uuid", "image_tag"])

        return payload


ForeignKeyConstraint(
    [
        EnvironmentImageBuildEvent.project_uuid,
        EnvironmentImageBuildEvent.environment_uuid,
        EnvironmentImageBuildEvent.image_tag,
    ],
    [
        _core_models.EnvironmentImageBuild.project_uuid,
        _core_models.EnvironmentImageBuild.environment_uuid,
        _core_models.EnvironmentImageBuild.image_tag,
    ],
    ondelete="CASCADE",
)


class JobEvent(ProjectEvent):
    """Job events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    job_uuid = db.Column(db.String(36), db.ForeignKey("jobs.uuid", ondelete="CASCADE"))

    __mapper_args__ = {"polymorphic_identity": "job_event"}

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == event.job_uuid
        ).one()
        payload = {
            "uuid": event.job_uuid,
            "name": job.name,
            "status": job.status,
            "pipeline_name": job.pipeline_name,
            "url_path": f"/job?project_uuid={job.project_uuid}&job_uuid={job.uuid}",
        }
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = JobEvent.current_layer_notification_data(event)
        event_properties.pop("name")
        event_properties.pop("pipeline_name")
        derived_properties = {}

        if event.type in [
            "project:cron-job:created",
            "project:cron-job:updated",
            "project:one-off-job:created",
            "project:one-off-job:updated",
        ]:
            job = _core_models.Job.query.filter(
                _core_models.Job.project_uuid == event.project_uuid,
                _core_models.Job.uuid == event.job_uuid,
            ).one()
            # Copy otherwise the job entry will be modified.
            ppl_def = copy.deepcopy(job.pipeline_definition)
            event_properties["definition"] = {
                "draft": True,
                # Note that the ppl_def is anonymized a few lines later.
                "pipeline_definition": ppl_def,
                # Deprecated fields.
                "uuid": job.uuid,
                "project_uuid": job.project_uuid,
                "pipeline_uuid": job.pipeline_uuid,
                "pipeline_run_spec": {"run_type": "full", "uuids": []},
            }
            derived_properties["definition"] = {
                "parameterized_runs_count": len(job.parameters),
                "env_variables_count": len(job.env_variables),
                "pipeline_definition": analytics.anonymize_pipeline_definition(ppl_def),
            }
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"] = JobEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = JobEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"] = ev
        payload["derived_properties"]["project"]["job"] = der

        # Deprecated.
        p_ev = payload["event_properties"]
        p_ev["job_uuid"] = p_ev["project"]["job"]["uuid"]
        if "deprecated" not in p_ev:
            p_ev["deprecated"] = []
        p_ev["deprecated"].append("job_uuid")
        if "definition" in p_ev["project"]["job"]:
            p_ev["job_definition"] = p_ev["project"]["job"]["definition"]
            p_ev["deprecated"].append("job_definition")
        return payload

    def __repr__(self):
        return (
            f"<JobEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}>"
        )


class OneOffJobEvent(JobEvent):
    """One-off job events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "one_off_job_event"}

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == event.job_uuid
        ).one()
        payload = {"total_runs": len(job.parameters)}
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = OneOffJobEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        # Here we just modify the current layer (i.e. `job` entry) in
        # place.
        payload["project"]["job"] = {
            **payload["project"]["job"],
            **OneOffJobEvent.current_layer_notification_data(self),
        }

        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = OneOffJobEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"] = {
            **payload["event_properties"]["project"]["job"],
            **ev,
        }
        payload["derived_properties"]["project"]["job"] = {
            **payload["derived_properties"]["project"]["job"],
            **der,
        }
        return payload

    def __repr__(self):
        return (
            f"<OneOffJobEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}>"
        )


class OneOffJobUpdateEvent(OneOffJobEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "one_off_job_update_event"}

    # See ProjectUpdateEvent.update for info.
    @declared_attr
    def update(cls):
        return Event.__table__.c.get("update", db.Column(JSONB, nullable=True))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {"update": event.update}
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = OneOffJobUpdateEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"][
            "update"
        ] = OneOffJobUpdateEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = OneOffJobUpdateEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"]["update"] = ev
        payload["derived_properties"]["project"]["job"]["update"] = der
        return payload


def _prepare_job_pipeline_run_parameters_payload(
    pipeline_definition: dict, run_parameters: dict
) -> dict:
    parameters_payload = {}
    for k, v in run_parameters.items():
        if k == "pipeline_parameters":
            parameters_payload["pipeline_parameters"] = {"parameters": v}
        else:
            step_name = pipeline_definition.get("steps").get(k, {}).get("title")
            step_payload = _prepare_step_payload(k, step_name)
            parameters_payload[k] = {"step": step_payload, "parameters": v}
    return parameters_payload


def _prepare_job_pipeline_run_payload(job_uuid: str, pipeline_run_uuid: str) -> dict:
    payload = {
        "uuid": pipeline_run_uuid,
        "parameters": None,
        "status": None,
    }

    job = _core_models.Job.query.filter(_core_models.Job.uuid == job_uuid).one()

    pipeline_run = _core_models.NonInteractivePipelineRun.query.filter(
        _core_models.NonInteractivePipelineRun.job_uuid == job_uuid,
        _core_models.NonInteractivePipelineRun.uuid == pipeline_run_uuid,
    ).one()

    payload["number"] = pipeline_run.pipeline_run_index
    if job.schedule is not None:
        payload["number_in_run"] = pipeline_run.job_run_pipeline_run_index

    payload["status"] = pipeline_run.status
    payload["parameters"] = _prepare_job_pipeline_run_parameters_payload(
        job.pipeline_definition, pipeline_run.parameters
    )
    payload["url_path"] = (
        f"/job-run?project_uuid={job.project_uuid}&pipeline_uuid={job.pipeline_uuid}&"
        f"job_uuid={job.uuid}&run_uuid={pipeline_run.uuid}"
    )

    if pipeline_run.status == "FAILURE":
        failed_steps_payload = []
        failed_steps = _core_models.PipelineRunStep.query.filter(
            _core_models.PipelineRunStep.run_uuid == pipeline_run_uuid,
            _core_models.PipelineRunStep.status == "FAILURE",
        ).all()
        for step in failed_steps:
            step_name = (
                job.pipeline_definition.get("steps")
                .get(step.step_uuid, {})
                .get("title")
            )
            failed_steps_payload.append(
                _prepare_step_payload(step.step_uuid, step_name)
            )
            payload["failed_steps"] = failed_steps_payload

    return payload


class OneOffJobPipelineRunEvent(OneOffJobEvent):
    """OneOffJob ppl runs events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    # See
    # https://docs.sqlalchemy.org/en/14/orm/inheritance.html#resolving-column-conflicts
    @declared_attr
    def pipeline_run_uuid(cls):
        return Event.__table__.c.get("pipeline_run_uuid", db.Column(db.String(36)))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = _prepare_job_pipeline_run_payload(
            event.job_uuid, event.pipeline_run_uuid
        )
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = OneOffJobPipelineRunEvent.current_layer_notification_data(
            event
        )
        event_properties = copy.deepcopy(event_properties)
        derived_properties = anonymize_pipeline_run_properties(event_properties)
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"][
            "pipeline_run"
        ] = OneOffJobPipelineRunEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = OneOffJobPipelineRunEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"]["pipeline_run"] = ev
        payload["derived_properties"]["project"]["job"]["pipeline_run"] = der
        return payload

    __mapper_args__ = {"polymorphic_identity": "one_off_job_pipeline_run_event"}

    def __repr__(self):
        return (
            f"<OneOffJobPipelineRunEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}, {self.pipeline_run_uuid}>"
        )


ForeignKeyConstraint(
    [OneOffJobPipelineRunEvent.pipeline_run_uuid],
    [_core_models.NonInteractivePipelineRun.uuid],
    ondelete="CASCADE",
)


class CronJobEvent(JobEvent):
    """Cron Job events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_event"}

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == event.job_uuid
        ).one()
        payload = {
            "schedule": job.schedule,
            "next_scheduled_time": job.next_scheduled_time,
        }
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = OneOffJobEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        # Here we just modify the current layer (i.e. `job` entry) in
        # place.
        payload["project"]["job"] = {
            **payload["project"]["job"],
            **OneOffJobEvent.current_layer_notification_data(self),
        }
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = OneOffJobEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"] = {
            **payload["event_properties"]["project"]["job"],
            **ev,
        }
        payload["derived_properties"]["project"]["job"] = {
            **payload["derived_properties"]["project"]["job"],
            **der,
        }
        return payload

    def __repr__(self):
        return (
            f"<CronJobEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}>"
        )


class CronJobUpdateEvent(CronJobEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_update_event"}

    # See ProjectUpdateEvent.update for info.
    @declared_attr
    def update(cls):
        return Event.__table__.c.get("update", db.Column(JSONB, nullable=True))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {"update": event.update}
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = CronJobUpdateEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"][
            "update"
        ] = CronJobUpdateEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = CronJobUpdateEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"]["update"] = ev
        payload["derived_properties"]["project"]["job"]["update"] = der
        return payload


class CronJobRunEvent(CronJobEvent):
    """Cron Job run events that happen in the orchest-api.

    A recurring run is an instance of a recurring job being triggered,
    i.e. a batch of runs.
    """

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_run_event"}

    run_index = db.Column(db.Integer)

    total_pipeline_runs = db.Column(db.Integer)

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        # Covers case of models inheriting from this.
        job_run_events = (
            db.session.query(CronJobRunEvent.type).filter(
                CronJobRunEvent.type.in_(
                    [
                        "project:cron-job:run:started",
                        "project:cron-job:run:succeeded",
                        "project:cron-job:run:failed",
                    ]
                ),
                CronJobRunEvent.project_uuid == event.project_uuid,
                CronJobRunEvent.job_uuid == event.job_uuid,
                CronJobRunEvent.run_index == event.run_index,
            )
        ).all()
        job_run_events = [ev.type for ev in job_run_events]

        if "project:cron-job:run:succeeded" in job_run_events:
            status = "SUCCESS"
        elif "project:cron-job:run:failed" in job_run_events:
            status = "FAILURE"
        elif "project:cron-job:run:started" in job_run_events:
            status = "STARTED"
        else:
            status = None

        payload = {}
        payload["status"] = status
        payload["number"] = event.run_index
        payload["total_pipeline_runs"] = event.total_pipeline_runs
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = CronJobRunEvent.current_layer_notification_data(event)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"][
            "run"
        ] = CronJobRunEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = CronJobRunEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"]["run"] = ev
        payload["derived_properties"]["project"]["job"]["run"] = der
        return payload

    def __repr__(self):
        return (
            f"<CronJobRunEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}, {self.run_index}>"
        )


Index(
    None,
    CronJobRunEvent.type,
    CronJobRunEvent.project_uuid,
    CronJobRunEvent.job_uuid,
    CronJobRunEvent.run_index,
)


class JupyterImageBuildEvent(Event):

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "jupyter_image_build_event"}

    build_uuid = db.Column(
        db.String(36),
        db.ForeignKey("jupyter_image_builds.uuid", ondelete="CASCADE"),
        nullable=True,
    )

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = {}
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        build = _core_models.JupyterImageBuild.query.filter(
            _core_models.JupyterImageBuild.uuid == event.build_uuid
        ).one()
        event_properties = JupyterImageBuildEvent.current_layer_notification_data(event)
        event_properties["image_tag"] = build.image_tag
        event_properties["requested_time"] = str(build.requested_time)
        event_properties["started_time"] = str(build.started_time)
        event_properties["finished_time"] = str(build.finished_time)
        derived_properties = {}
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["jupyter"] = {
            "image_build": JupyterImageBuildEvent.current_layer_notification_data(self)
        }
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = JupyterImageBuildEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["jupyter"] = {"image_build": ev}
        payload["derived_properties"]["jupyter"] = {"image_build": der}
        return payload


class CronJobRunPipelineRunEvent(CronJobRunEvent):
    """CronJob ppl runs events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_run_pipeline_run_event"}

    @declared_attr
    def pipeline_run_uuid(cls):
        return Event.__table__.c.get("pipeline_run_uuid", db.Column(db.String(36)))

    @staticmethod
    def current_layer_notification_data(event) -> dict:
        payload = _prepare_job_pipeline_run_payload(
            event.job_uuid, event.pipeline_run_uuid
        )
        return payload

    @staticmethod
    def current_layer_telemetry_data(event) -> Tuple[dict, dict]:
        event_properties = CronJobRunPipelineRunEvent.current_layer_notification_data(
            event
        )
        event_properties = copy.deepcopy(event_properties)
        derived_properties = anonymize_pipeline_run_properties(event_properties)
        return event_properties, derived_properties

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"]["run"][
            "pipeline_run"
        ] = CronJobRunPipelineRunEvent.current_layer_notification_data(self)
        return payload

    def to_telemetry_payload(self) -> analytics.TelemetryData:
        payload = super().to_telemetry_payload()
        ev, der = CronJobRunPipelineRunEvent.current_layer_telemetry_data(self)
        payload["event_properties"]["project"]["job"]["run"]["pipeline_run"] = ev
        payload["derived_properties"]["project"]["job"]["run"]["pipeline_run"] = der
        return payload

    def __repr__(self):
        return (
            f"<CronJobRunPipelineRunEvent: {self.uuid}, {self.type}, "
            f"{self.timestamp} {self.project_uuid}, {self.job_uuid}, {self.run_index}, "
            f"{self.pipeline_run_uuid}>"
        )


class Subscriber(_core_models.BaseModel):
    __tablename__ = "subscribers"

    uuid = db.Column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    type = db.Column(db.String(50), nullable=False)

    subscriptions = db.relationship(
        "Subscription",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    __mapper_args__ = {
        "polymorphic_on": "type",
        "polymorphic_identity": "subscriber",
        "with_polymorphic": "*",
    }


class Webhook(Subscriber):
    class ContentType(enum.Enum):
        JSON = "application/json"
        URLENCODED = "application/x-www-form-urlencoded"

    __tablename__ = None

    url = db.Column(db.String(), nullable=True)

    name = db.Column(db.String(100), nullable=True)

    verify_ssl = db.Column(db.Boolean(), nullable=True)

    # Used to calculate the HMAC digest of the payload and sign it.
    secret = deferred(db.Column(db.String(), nullable=True))

    content_type = db.Column(db.String(50), nullable=True)

    def is_slack_webhook(self) -> bool:
        return self.url.startswith("https://hooks.slack.com/")

    def is_discord_webhook(self) -> bool:
        return self.url.startswith("https://discord.com/api/webhooks/")

    def is_teams_webhook(self) -> bool:
        return "webhook.office.com" in self.url

    __mapper_args__ = {
        "polymorphic_identity": "webhook",
    }


class AnalyticsSubscriber(Subscriber):

    __tablename__ = None

    __mapper_args__ = {
        "polymorphic_identity": "analytics",
    }


class Subscription(_core_models.BaseModel):
    __tablename__ = "subscriptions"

    uuid = db.Column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    subscriber_uuid = db.Column(
        UUID(as_uuid=False),
        db.ForeignKey("subscribers.uuid", ondelete="CASCADE"),
        nullable=False,
    )

    event_type = db.Column(
        db.String(100),
        db.ForeignKey("event_types.name", ondelete="CASCADE"),
        nullable=False,
    )

    type = db.Column(db.String(50), nullable=False)

    __mapper_args__ = {
        "polymorphic_on": "type",
        "polymorphic_identity": "globally_scoped_subscription",
        # Load all subclass columns, see
        # https://docs.sqlalchemy.org/en/14/orm/inheritance_loading.html
        "with_polymorphic": "*",
    }


Index(
    "plain_subscription_uniqueness",
    Subscription.subscriber_uuid,
    Subscription.event_type,
    unique=True,
    postgresql_where=(Subscription.type == "globally_scoped_subscription"),
),


class ProjectSpecificSubscription(Subscription):
    """Subscripions to events of a specific project."""

    __tablename__ = None

    project_uuid = db.Column(
        db.String(36), db.ForeignKey("projects.uuid", ondelete="CASCADE")
    )

    __mapper_args__ = {
        "polymorphic_identity": "project_specific_subscription",
    }

    @staticmethod
    def check_constraints(mapper, connection, target):
        if not target.event_type.startswith("project:"):
            raise ValueError(
                "ProjectSpecificSubscription only allows to subscribe to 'project:*' "
                "event types."
            )


event.listen(
    ProjectSpecificSubscription,
    "before_insert",
    ProjectSpecificSubscription.check_constraints,
)

Index(
    "project_subscription_uniqueness",
    ProjectSpecificSubscription.subscriber_uuid,
    ProjectSpecificSubscription.event_type,
    ProjectSpecificSubscription.project_uuid,
    unique=True,
    postgresql_where=(
        ProjectSpecificSubscription.type == "project_specific_subscription"
    ),
),


class ProjectJobSpecificSubscription(ProjectSpecificSubscription):
    """Subscripions to events of a specific job of project."""

    __tablename__ = None

    __mapper_args__ = {
        "polymorphic_identity": "project_job_specific_subscription",
    }

    job_uuid = db.Column(db.String(36), db.ForeignKey("jobs.uuid", ondelete="CASCADE"))

    @staticmethod
    def check_constraints(mapper, connection, target):
        if not target.event_type.startswith(
            "project:job"
        ) and not target.event_type.startswith("project:cronjob:"):
            raise ValueError(
                "ProjectJobSpecificSubscription only allows to subscribe to "
                "'project:one-off-job:*' or 'project:cron-job:*' event types."
            )


event.listen(
    ProjectJobSpecificSubscription,
    "before_insert",
    ProjectJobSpecificSubscription.check_constraints,
)

Index(
    "project_job_subscription_uniqueness",
    ProjectJobSpecificSubscription.subscriber_uuid,
    ProjectJobSpecificSubscription.event_type,
    ProjectJobSpecificSubscription.project_uuid,
    ProjectJobSpecificSubscription.job_uuid,
    unique=True,
    postgresql_where=(
        ProjectJobSpecificSubscription.type == "project_job_specific_subscription"
    ),
),


class Delivery(_core_models.BaseModel):
    """Essentially, a transactional outbox for notifications.

    Extend this class if you need to keep track of information that
    depends on the deliveree, like response status code etc.
    """

    __tablename__ = "deliveries"

    uuid = db.Column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # The event which the delivery is about.
    event = db.Column(
        UUID(as_uuid=False),
        # Allow deletion of parent entities of an event (like a pipeline
        # run) while retaining the delivery.
        db.ForeignKey("events.uuid", ondelete="SET NULL"),
        nullable=True,
    )

    # The information content of the notification. The payload is
    # created in the same transaction where the event that triggered
    # this delivery is created, this way we can cover edge cases like
    # max_retained_pipeline_runs leading to the deletion of failed runs,
    # which would make it impossible to construct such a payload.
    notification_payload = db.Column(
        JSONB,
        nullable=False,
    )

    # The subscriber that subscribed to the event.
    deliveree = db.Column(
        UUID(as_uuid=False),
        db.ForeignKey("subscribers.uuid", ondelete="CASCADE"),
        nullable=False,
    )

    # SCHEDULED, RESCHEDULED, DELIVERED
    status = db.Column(db.String(15), nullable=False)

    # Used for capped exponential backoff of retries in combination with
    # scheduled_at.
    n_delivery_attempts = db.Column(db.Integer, nullable=False, default=0)

    scheduled_at = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    delivered_at = db.Column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    def reschedule(self) -> None:
        self.status = "RESCHEDULED"
        self.n_delivery_attempts = self.n_delivery_attempts + 1
        backoff = min(2 ** (self.n_delivery_attempts), 3600)
        now = datetime.datetime.now(datetime.timezone.utc)
        self.scheduled_at = now + datetime.timedelta(seconds=backoff)

    def set_delivered(self) -> None:
        self.status = "DELIVERED"
        self.delivered_at = datetime.datetime.now(datetime.timezone.utc)


Index(
    None,
    Delivery.status,
    Delivery.scheduled_at,
)
