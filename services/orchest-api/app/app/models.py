"""Models for the orchest-api

TODO:
    * Start using declarative base so we don't have to keep repeating
      the primary keys, relationships and foreignkeys.
      https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/mixins.html
    * Possibly add `pipeline_uuid` to the primary key.

"""
import copy
import datetime
import enum
import uuid
from typing import Any, Dict

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    UniqueConstraint,
    case,
    cast,
    event,
    func,
    or_,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import declared_attr, deferred

from app.connections import db


class BaseModel(db.Model):
    # Because the class inherits from `db.Model` SQLAlachemy will try to
    # create the table. ``__abstract__=True`` prevents this.
    __abstract__ = True

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def keep_column_entries(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove entries not related to the model columns from a dict.

        Can be used to sanitize a status update.
        """
        ans = {}
        columns = [c.name for c in cls.__table__.columns]
        for key, value in data.items():
            if key in columns:
                ans[key] = copy.deepcopy(value)
        return ans


class Setting(BaseModel):
    """The settings of Orchest."""

    __tablename__ = "settings"

    name = db.Column(db.String(50), primary_key=True, nullable=False)

    # We store the value as a JSON object {"value": <actual value>} to
    # be able to preserve types while storing 1 setting as 1 record.
    value = db.Column(JSONB, nullable=False)


class SchedulerJob(BaseModel):
    """Latest run of a job assigned to a Scheduler."""

    __tablename__ = "scheduler_jobs"

    type = db.Column(db.String(50), primary_key=True)

    # Used to make sure different instances of the Scheduler (due to
    # multiple gunicorn workers) don't cause a job to be executed
    # multiple times.
    timestamp = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self):
        return f"<SchedulerJob: {self.type}>"


class Project(BaseModel):
    __tablename__ = "projects"

    name = db.Column(
        db.String(255),
        unique=False,
        nullable=False,
        # For migrating old projects.
        server_default=text("'Project'"),
    )

    uuid = db.Column(db.String(36), primary_key=True, nullable=False)
    env_variables = deferred(db.Column(JSONB, nullable=False, server_default="{}"))

    # Note that all relationships are lazy=select.
    pipelines = db.relationship(
        "Pipeline", lazy="select", passive_deletes=True, cascade="all, delete"
    )
    environments = db.relationship(
        "Environment", lazy="select", passive_deletes=True, cascade="all, delete"
    )
    interactive_sessions = db.relationship(
        "InteractiveSession", lazy="select", passive_deletes=True, cascade="all, delete"
    )
    jobs = db.relationship(
        "Job", lazy="select", passive_deletes=True, cascade="all, delete"
    )
    pipeline_runs = db.relationship(
        "PipelineRun", lazy="select", passive_deletes=True, cascade="all, delete"
    )


class Pipeline(BaseModel):
    __tablename__ = "pipelines"

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        primary_key=True,
    )
    uuid = db.Column(db.String(36), primary_key=True, nullable=False)
    env_variables = deferred(db.Column(JSONB, nullable=False, server_default="{}"))

    # Note that all relationships are lazy=select.
    interactive_sessions = db.relationship(
        "InteractiveSession",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
        # NOTE: along with the other overlaps, this is necessary to
        # silence a warning stemming from the fact that the target table
        # in the relationship (InteractiveSession in this case) is also
        # in a relationship with Project. The alternative is to add more
        # boilerplate to 3 different tables, to support a use case where
        # we would be using sqlalchemy "smart" behaviour to change a
        # project uuid while also changing a related pipeline
        # project_uuid to a different value.
        overlaps="interactive_sessions",
    )
    jobs = db.relationship(
        "Job",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
        overlaps="jobs",
    )
    pipeline_runs = db.relationship(
        "PipelineRun",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
        overlaps="pipeline_runs",
    )


class Environment(BaseModel):
    __tablename__ = "environments"

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        primary_key=True,
    )
    uuid = db.Column(db.String(36), primary_key=True)

    images = db.relationship(
        "EnvironmentImage", lazy="select", passive_deletes=True, cascade="all, delete"
    )

    def __repr__(self):
        return f"<Environment: {self.project_uuid}-{self.environment_uuid}>"


class EnvironmentImageBuild(BaseModel):
    """State of environment image builds.

    There is a 1:1 mapping between an EnvironmentImage and an
    EnvironmentImageBuild.
    """

    __tablename__ = "environment_image_builds"

    # https://stackoverflow.com/questions/63164261/celery-task-id-max-length
    project_uuid = db.Column(
        db.String(36),
        primary_key=True,
        index=True,
    )
    environment_uuid = db.Column(
        db.String(36), nullable=False, index=True, primary_key=True
    )
    image_tag = db.Column(db.Integer, nullable=False, index=True, primary_key=True)
    # To be able to cancel the task.
    # https://stackoverflow.com/questions/63164261/celery-task-id-max-length
    celery_task_uuid = db.Column(db.String(36), primary_key=False, nullable=False)

    project_path = db.Column(db.String(4096), nullable=False, index=True)
    requested_time = db.Column(db.DateTime, unique=False, nullable=False)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)
    status = db.Column(db.String(15), unique=False, nullable=True)

    __table_args__ = (
        Index("uuid_proj_env_index", "project_uuid", "environment_uuid"),
        # To find the latest tag.
        Index(None, "project_uuid", "environment_uuid", image_tag.desc()),
    )

    def __repr__(self):
        return (
            f"<EnvironmentImageBuild: {self.project_uuid}-"
            f"{self.environment_uuid}-{self.image_tag}>"
        )


ForeignKeyConstraint(
    [
        EnvironmentImageBuild.project_uuid,
        EnvironmentImageBuild.environment_uuid,
    ],
    [
        Environment.project_uuid,
        Environment.uuid,
    ],
    ondelete="CASCADE",
)


class EnvironmentImage(BaseModel):
    __tablename__ = "environment_images"

    project_uuid = db.Column(
        db.String(36),
        nullable=False,
        primary_key=True,
        # To find all images of a project.
        index=True,
    )
    environment_uuid = db.Column(
        db.String(36),
        nullable=False,
        primary_key=True,
    )
    # A new environment image record with a given tag will be created
    # everytime an environment build is started, the tag only
    # increments.
    tag = db.Column(
        db.Integer,
        primary_key=True,
    )

    # sha256:<digest>
    digest = db.Column(
        db.String(71),
        nullable=False,
        index=True,
        # To migrate existing entries.
        server_default="Undefined",
    )

    # A way to tell us if a particular env image is to be considered
    # inactive and has already been put in the deletion outbox, to avoid
    # doing that again.
    marked_for_removal = db.Column(
        db.Boolean(),
        index=True,
        nullable=False,
        # To migrate existing entries.
        server_default="False",
    )

    __table_args__ = (
        # To find all images of the environment of a project.
        Index(None, "project_uuid", "environment_uuid"),
        # To find the latest tag.
        Index(None, "project_uuid", "environment_uuid", tag.desc()),
    )

    sessions_using_image = db.relationship(
        "InteractiveSessionInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    jobs_using_image = db.relationship(
        "JobInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    runs_using_image = db.relationship(
        "PipelineRunInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    def __repr__(self):
        return (
            "<EnvironmentImage: "
            f"{self.project_uuid}-{self.environment_uuid}-{self.tag}>"
        )


ForeignKeyConstraint(
    [EnvironmentImage.project_uuid, EnvironmentImage.environment_uuid],
    [Environment.project_uuid, Environment.uuid],
    ondelete="CASCADE",
)


ForeignKeyConstraint(
    [
        EnvironmentImage.project_uuid,
        EnvironmentImage.environment_uuid,
        EnvironmentImage.tag,
    ],
    [
        EnvironmentImageBuild.project_uuid,
        EnvironmentImageBuild.environment_uuid,
        EnvironmentImageBuild.image_tag,
    ],
    ondelete="CASCADE",
)


class JupyterImageBuild(BaseModel):
    """State of Jupyter image builds.

    Table meant to store the state of the build task of a
    Jupyter image, i.e. when a user wants to install a server side
    JupyterLab extension.

    """

    __tablename__ = "jupyter_image_builds"

    # https://stackoverflow.com/questions/63164261/celery-task-id-max-length
    uuid = db.Column(db.String(36), primary_key=True, nullable=False)
    requested_time = db.Column(db.DateTime, unique=False, nullable=False)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)
    status = db.Column(db.String(15), unique=False, nullable=True)
    # Nullable to migrate existing values.
    image_tag = db.Column(db.Integer, nullable=True, index=True, unique=True)

    def __repr__(self):
        return f"<JupyterEnvironmentBuildTask: {self.uuid}>"


class JupyterImage(BaseModel):
    __tablename__ = "jupyter_images"

    # A new image record with a given tag will be created everytime a
    # jupyter build is started, the tag only increments.
    tag = db.Column(
        db.Integer,
        db.ForeignKey("jupyter_image_builds.image_tag", ondelete="CASCADE"),
        primary_key=True,
    )

    # sha256:<digest>
    digest = db.Column(
        db.String(71),
        nullable=False,
        index=True,
    )

    # The image was built with a given Orchest version, this field is
    # used to invalidate a jupyter image after an update.
    base_image_version = db.Column(db.String(), nullable=False)

    # A way to tell us if a particular env image is to be considered
    # inactive and has already been put in the deletion outbox, to avoid
    # doing that again.
    marked_for_removal = db.Column(
        db.Boolean(),
        index=True,
        nullable=False,
        server_default="False",
    )

    def __repr__(self):
        return f"<JupyterImage: {self.tag}>"


class InteractiveSession(BaseModel):
    __tablename__ = "interactive_sessions"
    __table_args__ = (
        Index(
            "ix_interactive_sessions_project_uuid_pipeline_uuid",
            "project_uuid",
            "pipeline_uuid",
        ),
    )

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    pipeline_uuid = db.Column(db.String(36), primary_key=True, index=True)

    status = db.Column(
        db.String(10),
        primary_key=False,
    )

    # Services defined by the user.
    user_services = db.Column(
        JSONB,
        unique=False,
        nullable=True,
        # This way migrated entries that did not have this column will
        # still be valid.
        server_default="{}",
    )

    images_in_use = db.relationship(
        "InteractiveSessionInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    def __repr__(self):
        return f"<Launch {self.pipeline_uuid}>"


ForeignKeyConstraint(
    [InteractiveSession.project_uuid, InteractiveSession.pipeline_uuid],
    [Pipeline.project_uuid, Pipeline.uuid],
)


class Job(BaseModel):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_project_uuid_pipeline_uuid", "project_uuid", "pipeline_uuid"),
        Index("ix_jobs_next_scheduled_time_status", "next_scheduled_time", "status"),
        Index(
            "ix_jobs_project_uuid_next_scheduled_time_status",
            "project_uuid",
            "next_scheduled_time",
            "status",
        ),
    )

    name = db.Column(
        db.String(255),
        unique=False,
        nullable=False,
        # For migrating users.
        server_default=text("'job'"),
    )

    pipeline_name = db.Column(
        db.String(255),
        unique=False,
        nullable=False,
        # For migrating users.
        server_default=text("''"),
    )

    uuid = db.Column(db.String(36), primary_key=True)
    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    pipeline_uuid = db.Column(db.String(36), index=True, nullable=False)

    # Jobs that are to be schedule once (right now) or once in the
    # future will have no schedule (null).
    schedule = db.Column(db.String(100), nullable=True)

    # A list of dictionaries. The length of the list is the number of
    # non interactive runs that will be run, one for each parameters
    # dictionary. A parameter dictionary maps step uuids to a
    # dictionary, containing the parameters of that step for that
    # particular run.  [{ <step_uuid>: {"a": 1}, ...}, ...GG]
    parameters = db.Column(
        JSONB,
        nullable=False,
        # This way migrated entries that did not have this column will
        # still be valid. Note that the entries will be stored as a list
        # of dicts.
        server_default="[]",
    )

    # Note that this column also contains the parameters that were
    # stored within the pipeline definition file. These are not the job
    # parameters, but the original ones.
    pipeline_definition = db.Column(
        JSONB,
        nullable=False,
        # This way migrated entries that did not have this column will
        # still be valid.
        server_default="{}",
    )

    pipeline_run_spec = db.Column(
        JSONB,
        nullable=False,
        # This way migrated entries that did not have this column will
        # still be valid.
        server_default="{}",
    )

    # So that we can efficiently look for jobs to run.
    next_scheduled_time = db.Column(TIMESTAMP(timezone=True), index=True)

    # So that we can show the user the last time it was scheduled/run.
    last_scheduled_time = db.Column(TIMESTAMP(timezone=True), index=True)

    # So that we can "stamp" every non interactive run with the
    # execution number it belongs to, e.g. the first time a job runs it
    # will be batch 1, then 2, etc.
    total_scheduled_executions = db.Column(
        db.Integer,
        unique=False,
        server_default=text("0"),
    )

    # Total scheduled pipeline runs across all job run triggers. This is
    # used to "stamp" every job pipeline run with a pipeline_run_index.
    # This is is needed because a job could be modified with new
    # parameters and all existing job runs could be deleted because of
    # max_retained_pipeline_runs or manual deletion, making it not
    # possible to get back to this number otherwise.
    total_scheduled_pipeline_runs = db.Column(
        db.Integer,
        unique=False,
        server_default=text("0"),
        nullable=False,
    )

    pipeline_runs = db.relationship(
        "NonInteractivePipelineRun",
        lazy="select",
        # let the db take care of cascading deletions
        # https://docs.sqlalchemy.org/en/13/orm/relationship_api.html#sqlalchemy.orm.relationship.params.passive_deletes
        # A value of True indicates that unloaded child items should not
        # be loaded during a delete operation on the parent. Normally,
        # when a parent item is deleted, all child items are loaded so
        # that they can either be marked as deleted, or have their
        # foreign key to the parent set to NULL. Marking this flag as
        # True usually implies an ON DELETE <CASCADE|SET NULL> rule is
        # in place which will handle updating/deleting child rows on the
        # database side.
        passive_deletes=True,
        # https://docs.sqlalchemy.org/en/14/orm/cascades.html#using-foreign-key-on-delete-cascade-with-orm-relationships
        # In order to use ON DELETE foreign key cascades in conjunction
        # with relationship(), it’s important to note first and foremost
        # that the relationship.cascade setting must still be configured
        # to match the desired “delete” or “set null” behavior
        # Essentially, the specified behaviour in the FK column
        # and the one specified in the relationship must match.
        cascade="all, delete",
        # When querying a job and its runs the runs will be sorted by
        # job schedule number and the index of the pipeline in that job.
        order_by=(
            "[desc(NonInteractivePipelineRun.job_run_index), "
            "desc(NonInteractivePipelineRun.job_run_pipeline_run_index)]"
        ),
    )

    # The status of a job can be DRAFT, PENDING, STARTED, PAUSED
    # SUCCESS, ABORTED, FAILURE. Only recurring jobs can be PAUSED. Jobs
    # start as DRAFT, this indicates that the job has been created but
    # that has not been started by the user. Once a job is started by
    # the user, what happens depends on the type of job. One time jobs
    # become PENDING, and become STARTED once they are run by the
    # scheduler and their pipeline runs are added to the queue. Once
    # they are completed, their status will be SUCCESS, if they are
    # aborted, their status will be set to ABORTED. Recurring jobs,
    # characterized by having a schedule, become STARTED, and can only
    # move to the ABORTED state in case they get cancelled, which
    # implies that the job will not be scheduled anymore. Recurring jobs
    # can be PAUSED to temporarily stop them from running. One time jobs
    # which fail to run (the related pipeline runs scheduling fails) are
    # set to FAILURE, this is not related to a failure at the pipeline
    # run level.
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=False,
        # Pre-existing Jobs of migrating users will be set to SUCCESS.
        server_default=text("'SUCCESS'"),
    )

    strategy_json = db.Column(
        JSONB,
        nullable=False,
        server_default="{}",
    )

    env_variables = deferred(
        db.Column(
            JSONB,
            nullable=False,
            server_default="{}",
        )
    )

    created_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=False,
        index=True,
        # For migrating users.
        server_default=text("timezone('utc', now())"),
    )

    # Max number of pipeline runs to retain. So that any newly created
    # runs (e.g. in a cronjob) will lead to the deletion of the
    # existing, oldest runs that are in an end state if the total number
    # of job runs in the DB gets past this value. A value of -1 means
    # that there is no such limit. The default value is -1.
    max_retained_pipeline_runs = db.Column(
        db.Integer, nullable=False, server_default=text("-1")
    )

    images_in_use = db.relationship(
        "JobInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )

    def __repr__(self):
        return f"<Job: {self.uuid}>"


ForeignKeyConstraint(
    [Job.project_uuid, Job.pipeline_uuid], [Pipeline.project_uuid, Pipeline.uuid]
)


class PipelineRun(BaseModel):
    __tablename__ = "pipeline_runs"
    __table_args__ = (
        Index(
            "ix_pipeline_runs_project_uuid_pipeline_uuid",
            "project_uuid",
            "pipeline_uuid",
        ),
    )

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    pipeline_uuid = db.Column(db.String(36), index=True, unique=False, nullable=False)
    uuid = db.Column(db.String(36), primary_key=True)
    status = db.Column(db.String(15), unique=False, nullable=True)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)
    type = db.Column(db.String(50))

    pipeline_steps = db.relationship(
        "PipelineRunStep",
        lazy="joined",
        passive_deletes=True,
        cascade="all, delete",
    )

    # related to inheritance, the "type" column will be used to
    # differentiate the different classes of entities
    __mapper_args__ = {
        "polymorphic_identity": "PipelineRun",
        "polymorphic_on": type,
    }

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.uuid}>"


ForeignKeyConstraint(
    [PipelineRun.project_uuid, PipelineRun.pipeline_uuid],
    [Pipeline.project_uuid, Pipeline.uuid],
)


class PipelineRunStep(BaseModel):
    __tablename__ = "pipeline_run_steps"

    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey("pipeline_runs.uuid", ondelete="CASCADE"),
        primary_key=True,
    )

    step_uuid = db.Column(db.String(36), primary_key=True)
    status = db.Column(db.String(15), unique=False, nullable=True)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.run_uuid}.{self.step_uuid}>"


def _create_text_search_vector(*args):
    exp = args[0]
    for e in args[1:]:
        exp += " " + e
    return func.to_tsvector("simple", exp)


class NonInteractivePipelineRun(PipelineRun):
    # https://docs.sqlalchemy.org/en/14/orm/inheritance.html
    # sqlalchemy has 3 kinds of inheritance: joined table, single table,
    # concrete.
    #
    # Concrete is, essentially, not recommended unless you have a
    # reason to use it. Will also lead to FKs issues if the base table
    # is abstract.
    #
    # "ORM-enabled UPDATEs and DELETEs do not handle joined table
    # inheritance automatically." This means that, for example, that
    # updating a NonInteractivePipelineRun would not allow updating the
    # columns that belong to the InteractiveRun. This means that, for
    # for example, the update_status_db function from the utils module
    # would not work when updating the status of a non interactive run.
    # https://docs.sqlalchemy.org/en/14/orm/session_basics.html#update-and-delete-with-arbitrary-where-clause
    #
    # Single table inheritance is the inheritance of choice, mostly
    # because of the drawbacks of joined table inheritance. Setting the
    # tablename to None will result in using single table inheritance,
    # setting it to a string will result in using joined table
    # inheritance.
    # Note that single table inheritance will NOT create a new table for
    # each "child" of the inheritance.
    __tablename__ = None

    # TODO: verify why the job_uuid should be part of the
    # primary key
    job_uuid = db.Column(
        db.String(36), db.ForeignKey("jobs.uuid", ondelete="CASCADE"), index=True
    )

    # To what batch of non interactive runs of a job it belongs. The
    # first time a job runs will produce batch 1, then batch 2, etc.
    job_run_index = db.Column(
        db.Integer,
        nullable=False,
        server_default=text("0"),
    )

    # This run_id is used to identify the pipeline run within the
    # job and maintain a consistent ordering.
    job_run_pipeline_run_index = db.Column(
        db.Integer,
    )

    # The pipeline run number across all job runs of a job.
    pipeline_run_index = db.Column(
        db.Integer,
    )

    # Parameters with which it was run, so that the history is kept.
    parameters = db.Column(
        JSONB,
        nullable=False,
        # This way migrated entries that did not have this column will
        # still be valid.
        server_default="{}",
    )

    # Used for text search, excludes step uuids.
    parameters_text_search_values = db.Column(
        JSONB,
        nullable=False,
        server_default="[]",
    )

    env_variables = deferred(
        db.Column(
            JSONB,
            nullable=False,
            server_default="{}",
        )
    )

    __text_search_vector = _create_text_search_vector(
        func.lower(cast(pipeline_run_index, postgresql.TEXT)),
        # This is needed to reflect what the FE is showing to the user.
        case(
            [
                (PipelineRun.status == "ABORTED", "cancelled"),
                (PipelineRun.status == "FAILURE", "failed"),
                (PipelineRun.status == "STARTED", "running"),
            ],
            else_=func.lower(PipelineRun.status),
        ),
        func.lower(cast(parameters_text_search_values, postgresql.TEXT)),
    )

    # related to inheriting from PipelineRun
    __mapper_args__ = {
        "polymorphic_identity": "NonInteractivePipelineRun",
    }


Index(
    "ix_job_pipeline_runs_text_search",
    NonInteractivePipelineRun._NonInteractivePipelineRun__text_search_vector,
    postgresql_using="gin",
)


# Used to find old job pipeline runs to delete, see
# jobs.max_retained_pipeline_runs.
Index(
    "ix_type_job_uuid_pipeline_run_index",
    NonInteractivePipelineRun.type,
    NonInteractivePipelineRun.job_uuid,
    NonInteractivePipelineRun.pipeline_run_index,
)

UniqueConstraint(
    NonInteractivePipelineRun.job_uuid,
    NonInteractivePipelineRun.pipeline_run_index,
)


# Each job execution can be seen as a batch of runs, identified through
# the job_run_index, each pipeline run id, which is essentially
# the index of the run in this job, must be unique at the level of the
# batch of runs.
UniqueConstraint(
    NonInteractivePipelineRun.job_uuid,
    NonInteractivePipelineRun.job_run_index,
    NonInteractivePipelineRun.job_run_pipeline_run_index,
)


class InteractivePipelineRun(PipelineRun):
    # Just a wrapper around PipelineRun so that we can selectively
    # reference InteractivePipelineRun(s) without filtering by the type
    # column, which would be error prone.
    # PipelineRun.query.filter_by(type="PipelineRun").all() becomes
    # InteractivePipelineRun.query.all()
    __tablename__ = None

    __mapper_args__ = {
        "polymorphic_identity": "InteractivePipelineRun",
    }

    images_in_use = db.relationship(
        "PipelineRunInUseImage",
        lazy="select",
        passive_deletes=True,
        cascade="all, delete",
    )


class ClientHeartbeat(BaseModel):
    """Clients heartbeat for idle checking."""

    __tablename__ = "client_heartbeats"

    id = db.Column(db.BigInteger, primary_key=True)

    timestamp = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        index=True,
        server_default=func.now(),
    )


class InteractiveSessionInUseImage(BaseModel):
    """Mappings between an interactive session and environment images.

    Used to understand if an image can be removed from the registry
    environment if it's not used by an interactive session. This could
    be the case when an interactive session is using an orchest
    environment as a service.
    """

    __tablename__ = "interactive_session_in_use_images"

    project_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True, index=True
    )

    environment_image_tag = db.Column(
        db.Integer, unique=False, nullable=False, primary_key=True, index=True
    )

    def __repr__(self):
        return (
            f"<InteractiveSessionInUseImage: {self.project_uuid}-"
            f"{self.pipeline_uuid} | {self.environment_uuid} | "
            f"{self.environment_image_tag}>"
        )


ForeignKeyConstraint(
    [
        InteractiveSessionInUseImage.project_uuid,
        InteractiveSessionInUseImage.pipeline_uuid,
    ],
    [InteractiveSession.project_uuid, InteractiveSession.pipeline_uuid],
    ondelete="CASCADE",
)
ForeignKeyConstraint(
    [
        InteractiveSessionInUseImage.project_uuid,
        InteractiveSessionInUseImage.environment_uuid,
        InteractiveSessionInUseImage.environment_image_tag,
    ],
    [
        EnvironmentImage.project_uuid,
        EnvironmentImage.environment_uuid,
        EnvironmentImage.tag,
    ],
    ondelete="CASCADE",
)


class JobInUseImage(BaseModel):
    """Stores mappings between a job and the environment images it uses.

    Used to understand if an image can be removed from the registry if
    it's not used by a job which is PENDING or STARTED.

    """

    __tablename__ = "job_in_use_images"

    job_uuid = db.Column(
        db.ForeignKey(Job.uuid, ondelete="CASCADE"),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    project_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True, index=True
    )

    environment_image_tag = db.Column(
        db.Integer, unique=False, nullable=False, primary_key=True, index=True
    )

    def __repr__(self):
        return (
            f"<JobInUseImage: {self.job_uuid} | "
            f"{self.project_uuid} | "
            f"{self.environment_uuid} | "
            f"{self.environment_image_tag}>"
        )


ForeignKeyConstraint(
    [
        JobInUseImage.project_uuid,
        JobInUseImage.environment_uuid,
        JobInUseImage.environment_image_tag,
    ],
    [
        EnvironmentImage.project_uuid,
        EnvironmentImage.environment_uuid,
        EnvironmentImage.tag,
    ],
    ondelete="CASCADE",
)


class PipelineRunInUseImage(BaseModel):
    """Mappings between a pipeline run and environment images it uses.

    Used to understand if an image can be removed from the registry if
    it's not used by a run which is PENDING or STARTED.  Currently, this
    only references interactive runs.

    """

    __tablename__ = "pipeline_run_in_use_images"

    run_uuid = db.Column(
        db.ForeignKey(PipelineRun.uuid, ondelete="CASCADE"),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    project_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )

    environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True, index=True
    )

    environment_image_tag = db.Column(
        db.Integer, unique=False, nullable=False, primary_key=True, index=True
    )

    def __repr__(self):
        return (
            f"<PipelineRunInUseImage: {self.run_uuid} | "
            f"{self.project_uuid} | "
            f"{self.environment_uuid} | "
            f"{self.environment_image_tag}>"
        )


ForeignKeyConstraint(
    [
        PipelineRunInUseImage.project_uuid,
        PipelineRunInUseImage.environment_uuid,
        PipelineRunInUseImage.environment_image_tag,
    ],
    [
        EnvironmentImage.project_uuid,
        EnvironmentImage.environment_uuid,
        EnvironmentImage.tag,
    ],
    ondelete="CASCADE",
)


class EventType(BaseModel):
    """Type of events recorded by the orchest-api.

    The table has been pre-populated in the schema migration that
    created it, if you need to add more types add another schema
    migration. Migrations that have added event types:
    - services/orchest-api/app/migrations/versions/410e08270de4_.py
    - services/orchest-api/app/migrations/versions/814961a3d525_.py
    - services/orchest-api/app/migrations/versions/92dcc9963a9c_.py

    To add more types, add an empty revision with
    `bash scripts/migration_manager.sh orchest-api revision`, then
    add the statements to add more types to the event_types table in the
    revision, take a look at the existing migrations for that.
    """

    __tablename__ = "event_types"

    name = db.Column(db.String(50), primary_key=True)

    def __repr__(self):
        return f"<EventType: {self.name}>"


class Event(BaseModel):
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
        db.String(50), db.ForeignKey("event_types.name", ondelete="CASCADE"), index=True
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
                    type.startswith("project:cron-job:run:pipeline-run:"),
                    "cron_job_run_pipeline_run_event",
                ),
                (
                    type.startswith("project:cron-job:run:"),
                    "cron_job_run_event",
                ),
                (type.startswith("project:cron-job:"), "cron_job_event"),
                (
                    type.startswith("project:one-off-job:pipeline-run:"),
                    "one_off_job_pipeline_run_event",
                ),
                (type.startswith("project:one-off-job:"), "one_off_job_event"),
                (
                    or_(
                        type.startswith("project:one-off-job:"),
                        type.startswith("project:cron-job:"),
                    ),
                    "job_event",
                ),
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

    project_uuid = db.Column(
        db.String(36), db.ForeignKey("projects.uuid", ondelete="CASCADE")
    )

    __mapper_args__ = {"polymorphic_identity": "project_event"}

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        project_payload = {"uuid": self.project_uuid, "name": None}
        payload["project"] = project_payload

        proj = Project.query.filter(Project.uuid == self.project_uuid).first()
        if proj is not None:
            project_payload["name"] = proj.name

        return payload

    def __repr__(self):
        return (
            f"<ProjectEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}>"
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
        payload["job"] = job_payload

        job = Job.query.filter(Job.uuid == self.job_uuid).first()
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

        payload["job"]["total_runs"] = None

        job = Job.query.filter(Job.uuid == self.job_uuid).first()
        if job is None:
            return payload

        payload["job"]["total_runs"] = len(job.parameters)

        return payload

    def __repr__(self):
        return (
            f"<OneOffJobEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}>"
        )


def _prepare_parameters_payload(
    pipeline_definition: dict, run_parameters: dict
) -> dict:
    parameters_payload = {}
    for k, v in run_parameters.items():
        if k == "pipeline_parameters":
            parameters_payload[k] = v
        else:
            step_name = pipeline_definition.get("steps").get(k, {}).get("title")
            if step_name is None:
                step_name = "untitled"
            parameters_payload[f"step-{step_name}-{k}"] = v
    return parameters_payload


def _prepare_job_pipeline_run_payload(job_uuid: str, pipeline_run_uuid: str) -> dict:
    payload = {
        "uuid": pipeline_run_uuid,
        "parameters": None,
        "status": None,
    }

    job = Job.query.filter(Job.uuid == job_uuid).first()
    if job is None:
        return payload

    pipeline_run = NonInteractivePipelineRun.query.filter(
        NonInteractivePipelineRun.job_uuid == job_uuid,
        NonInteractivePipelineRun.uuid == pipeline_run_uuid,
    ).first()
    if pipeline_run is None:
        return payload

    payload["number"] = pipeline_run.pipeline_run_index
    if job.schedule is not None:
        payload["number_in_run"] = pipeline_run.job_run_pipeline_run_index

    payload["status"] = pipeline_run.status
    payload["parameters"] = _prepare_parameters_payload(
        job.pipeline_definition, pipeline_run.parameters
    )
    payload["url_path"] = (
        f"/job-run?project_uuid={job.project_uuid}&pipeline_uuid={job.pipeline_uuid}&"
        f"job_uuid={job.uuid}&run_uuid={pipeline_run.uuid}"
    )

    if pipeline_run.status == "FAILURE":
        failed_steps_payload = []
        failed_steps = PipelineRunStep.query.filter(
            PipelineRunStep.run_uuid == pipeline_run_uuid,
            PipelineRunStep.status == "FAILURE",
        ).all()
        for step in failed_steps:
            step_name = (
                job.pipeline_definition.get("steps")
                .get(step.step_uuid, {})
                .get("title")
            )
            failed_steps_payload.append(f"step-{step_name}-{step.step_uuid}")
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
        payload["job"]["pipeline_run"] = _prepare_job_pipeline_run_payload(
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
    [NonInteractivePipelineRun.uuid],
    ondelete="CASCADE",
)


class CronJobEvent(JobEvent):
    """Cron Job events that happen in the orchest-api."""

    # Single table inheritance.
    __tablename__ = None

    __mapper_args__ = {"polymorphic_identity": "cron_job_event"}

    def to_notification_payload(self) -> dict:
        payload = super().to_notification_payload()
        payload["job"]["schedule"] = None
        payload["job"]["next_scheduled_time"] = None

        job = Job.query.filter(Job.uuid == self.job_uuid).first()
        if job is None:
            return payload
        payload["job"]["schedule"] = job.schedule
        payload["job"]["next_scheduled_time"] = str(job.next_scheduled_time)
        return payload

    def __repr__(self):
        return (
            f"<CronJobEvent: {self.uuid}, {self.type}, {self.timestamp}, "
            f"{self.project_uuid}, {self.job_uuid}>"
        )


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

        payload["job"]["run"] = {}
        payload["job"]["run"]["status"] = status
        payload["job"]["run"]["number"] = self.run_index
        payload["job"]["run"]["total_pipeline_runs"] = self.total_pipeline_runs

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
        payload["job"]["run"]["pipeline_run"] = _prepare_job_pipeline_run_payload(
            self.job_uuid, self.pipeline_run_uuid
        )

        return payload

    def __repr__(self):
        return (
            f"<CronJobRunPipelineRunEvent: {self.uuid}, {self.type}, "
            f"{self.timestamp} {self.project_uuid}, {self.job_uuid}, {self.run_index}, "
            f"{self.pipeline_run_uuid}>"
        )


class Subscriber(BaseModel):
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

    url = db.Column(db.String(), nullable=False)

    name = db.Column(db.String(100), nullable=False)

    verify_ssl = db.Column(db.Boolean(), nullable=False)

    # Used to calculate the HMAC digest of the payload and sign it.
    secret = deferred(db.Column(db.String(), nullable=False))

    content_type = db.Column(db.String(50), nullable=False)

    def is_slack_webhook(self) -> bool:
        return self.url.startswith("https://hooks.slack.com/")

    def is_discord_webhook(self) -> bool:
        return self.url.startswith("https://discord.com/api/webhooks/")

    def is_teams_webhook(self) -> bool:
        return "webhook.office.com" in self.url

    __mapper_args__ = {
        "polymorphic_identity": "webhook",
    }


class Subscription(BaseModel):
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
        db.String(50),
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


class Delivery(BaseModel):
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
