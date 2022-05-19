"""Events models for the orchest-api."""
import datetime
import enum
import uuid

from sqlalchemy import ForeignKeyConstraint, Index, case, event, func, or_
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import declared_attr, deferred

import app.models._core as _core_models
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

    def to_notification_payload(self) -> dict:
        payload = {
            "uuid": self.uuid,
            "type": self.type,
            "timestamp": str(self.timestamp),
        }
        return payload

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        project_payload = {"uuid": self.project_uuid, "name": None}
        payload["project"] = project_payload

        proj = _core_models.Project.query.filter(
            _core_models.Project.uuid == self.project_uuid
        ).first()
        if proj is not None:
            project_payload["name"] = proj.name

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        if self.update is not None:
            payload["project"]["update"] = self.update

        return payload


class PipelineEvent(ProjectEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "pipeline_event"}

    @declared_attr
    def pipeline_uuid(cls):
        return Event.__table__.c.get("pipeline_uuid", db.Column(db.String(36)))

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"] = {"uuid": self.pipeline_uuid}
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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        if self.update is not None:
            payload["project"]["pipeline"]["update"] = self.update

        return payload


def _prepare_step_payload(uuid: str, title: str) -> dict:
    return {
        "uuid": uuid,
        "title": title,
    }


def _prepare_interactive_run_parameters_payload(pipeline_definition: dict) -> dict:
    parameters_payload = {}
    for k, v in pipeline_definition["steps"].items():
        step_name = pipeline_definition.get("steps").get(k, {}).get("title", "untitled")
        step_payload = _prepare_step_payload(k, step_name)
        parameters_payload[k] = {
            "step": step_payload,
            "parameters": v.get("parameters", {}),
        }
    parameters_payload["pipeline_parameters"] = {
        "parameters": pipeline_definition.get("parameters", {})
    }
    return parameters_payload


def _prepare_interactive_pipeline_run_payload(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> dict:
    payload = {
        "uuid": pipeline_run_uuid,
        "parameters": None,
        "status": None,
        "steps": None,
    }

    pipeline_run = _core_models.InteractivePipelineRun.query.filter(
        _core_models.InteractivePipelineRun.project_uuid == project_uuid,
        _core_models.InteractivePipelineRun.pipeline_uuid == pipeline_uuid,
        _core_models.InteractivePipelineRun.uuid == pipeline_run_uuid,
    ).first()
    if pipeline_run is None:
        return payload

    payload["status"] = pipeline_run.status
    payload["parameters"] = _prepare_interactive_run_parameters_payload(
        pipeline_run.pipeline_definition
    )
    payload[
        "url_path"
    ] = f"/pipeline?project_uuid={project_uuid}&pipeline_uuid={pipeline_uuid}"
    payload["steps"] = []
    failed_steps = []
    steps = _core_models.PipelineRunStep.query.filter(
        _core_models.PipelineRunStep.run_uuid == pipeline_run_uuid,
    ).all()
    for step in steps:
        step_name = (
            pipeline_run.pipeline_definition.get("steps")
            .get(step.step_uuid, {})
            .get("title", "untitled")
        )
        step_payload = _prepare_step_payload(step.step_uuid, step_name)
        payload["steps"].append(step_payload)
        if step.status == "FAILURE":
            failed_steps.append(step_payload)

    if failed_steps:
        payload["failed_steps"] = failed_steps

    return payload


class InteractiveSessionEvent(PipelineEvent):

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "interactive_session_event"}

    @declared_attr
    def pipeline_uuid(cls):
        return Event.__table__.c.get("pipeline_uuid", db.Column(db.String(36)))

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        session_payload = {}
        payload["project"]["pipeline"]["session"] = session_payload
        return payload


ForeignKeyConstraint(
    [InteractiveSessionEvent.project_uuid, InteractiveSessionEvent.pipeline_uuid],
    [_core_models.Pipeline.project_uuid, _core_models.Pipeline.uuid],
    ondelete="CASCADE",
)


class InteractivePipelineRunEvent(InteractiveSessionEvent):

    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "interactive_pipeline_run_event"}

    @declared_attr
    def pipeline_run_uuid(cls):
        return Event.__table__.c.get("pipeline_run_uuid", db.Column(db.String(36)))

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["pipeline"]["session"][
            "pipeline_run"
        ] = _prepare_interactive_pipeline_run_payload(
            self.project_uuid, self.pipeline_uuid, self.pipeline_run_uuid
        )
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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["environment"] = {
            "uuid": self.environment_uuid,
            "url_path": (
                f"/environment?project_uuid={self.project_uuid}&environment_uuid="
                f"{self.environment_uuid}"
            ),
        }
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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        build = _core_models.EnvironmentImageBuild.query.filter(
            _core_models.EnvironmentImageBuild.project_uuid == self.project_uuid,
            _core_models.EnvironmentImageBuild.environment_uuid
            == self.environment_uuid,
            _core_models.EnvironmentImageBuild.image_tag == self.image_tag,
        ).first()
        if build is not None:
            build = build.as_dict()
            for k, v in build.items():
                if isinstance(v, datetime.datetime):
                    build[k] = str(v)
            payload["project"]["environment"]["image_build"] = build
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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        job_payload = {
            "uuid": self.job_uuid,
            "name": None,
            "status": None,
            "pipeline_name": None,
        }
        payload["project"]["job"] = job_payload

        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == self.job_uuid
        ).first()
        if job is None:
            return payload

        job_payload["name"] = job.name
        job_payload["status"] = job.status
        job_payload["pipeline_name"] = job.pipeline_name
        job_payload[
            "url_path"
        ] = f"/job?project_uuid={job.project_uuid}&job_uuid={job.uuid}"

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()

        payload["project"]["job"]["total_runs"] = None

        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == self.job_uuid
        ).first()
        if job is None:
            return payload

        payload["project"]["job"]["total_runs"] = len(job.parameters)

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        if self.update is not None:
            payload["project"]["job"]["update"] = self.update

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

    job = _core_models.Job.query.filter(_core_models.Job.uuid == job_uuid).first()
    if job is None:
        return payload

    pipeline_run = _core_models.NonInteractivePipelineRun.query.filter(
        _core_models.NonInteractivePipelineRun.job_uuid == job_uuid,
        _core_models.NonInteractivePipelineRun.uuid == pipeline_run_uuid,
    ).first()
    if pipeline_run is None:
        return payload

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
                .get("title", "untitled")
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

    __mapper_args__ = {"polymorphic_identity": "one_off_job_pipeline_run_event"}

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"]["pipeline_run"] = _prepare_job_pipeline_run_payload(
            self.job_uuid, self.pipeline_run_uuid
        )

        return payload

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"]["schedule"] = None
        payload["project"]["job"]["next_scheduled_time"] = None

        job = _core_models.Job.query.filter(
            _core_models.Job.uuid == self.job_uuid
        ).first()
        if job is None:
            return payload
        payload["project"]["job"]["schedule"] = job.schedule
        payload["project"]["job"]["next_scheduled_time"] = str(job.next_scheduled_time)
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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        if self.update is not None:
            payload["project"]["job"]["update"] = self.update

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()

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
                CronJobRunEvent.project_uuid == self.project_uuid,
                CronJobRunEvent.job_uuid == self.job_uuid,
                CronJobRunEvent.run_index == self.run_index,
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

        payload["project"]["job"]["run"] = {}
        payload["project"]["job"]["run"]["status"] = status
        payload["project"]["job"]["run"]["number"] = self.run_index
        payload["project"]["job"]["run"][
            "total_pipeline_runs"
        ] = self.total_pipeline_runs

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

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["jupyter"] = {}
        build = _core_models.JupyterImageBuild.query.filter(
            _core_models.JupyterImageBuild.uuid == self.build_uuid
        ).first()
        if build is not None:
            payload["jupyter"]["image_build"] = build.as_dict()
            for k, v in payload["jupyter"]["image_build"].items():
                if isinstance(v, datetime.datetime):
                    payload["jupyter"]["image_build"][k] = str(v)
        return payload


class CronJobRunPipelineRunEvent(CronJobRunEvent):
    """CronJob ppl runs events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_run_pipeline_run_event"}

    @declared_attr
    def pipeline_run_uuid(cls):
        return Event.__table__.c.get("pipeline_run_uuid", db.Column(db.String(36)))

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["project"]["job"]["run"][
            "pipeline_run"
        ] = _prepare_job_pipeline_run_payload(self.job_uuid, self.pipeline_run_uuid)

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
