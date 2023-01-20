"""Core models for the orchest-api.

TODO:
    * Start using declarative base so we don't have to keep repeating
      the primary keys, relationships and foreignkeys.
      https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/mixins.html
    * Possibly add `pipeline_uuid` to the primary key.

"""
import copy
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    UniqueConstraint,
    case,
    cast,
    func,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import deferred

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

    # Requires Orchest to be restarted in order to apply the setting.
    requires_restart = db.Column(
        db.Boolean(),
        nullable=False,
        default=False,
        # To migrate existing entries.
        server_default="False",
    )


class SchedulerJob(BaseModel):
    """Job runs of the internal scheduler."""

    __tablename__ = "scheduler_jobs"

    uuid = db.Column(
        db.String(36),
        primary_key=True,
        nullable=False,
        server_default=text("gen_random_uuid()"),
    )

    type = db.Column(db.String(50), nullable=False)

    # Used to make sure different instances of the Scheduler (due to
    # multiple gunicorn workers) don't cause a job to be executed
    # multiple times.
    started_time = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    finished_time = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # STARTED, SUCCEEDED, FAILED
    status = db.Column(
        db.String(15), unique=False, nullable=False, server_default="SUCCEEDED"
    )

    __table_args__ = (
        # For the scheduler to query the latest job by type.
        Index(None, type, started_time.desc()),
    )

    def __repr__(self):
        return f"<SchedulerJob: {self.type}:{self.uuid}>"


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

    name = db.Column(
        db.String(255),
        unique=False,
        nullable=False,
        # For migrating old pipelines.
        server_default=text("'Pipeline'"),
    )

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

    cluster_node = db.Column(
        db.String(),
        # Note that we SET NULL on deletion to avoid losing information
        # about the build if the nodes gets deleted.
        db.ForeignKey("cluster_nodes.name", ondelete="SET NULL"),
        # To migrate existing records.
        nullable=True,
    )

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
    # REMOVABLE_ON_BREAKING_CHANGE
    # This is needed to not break existing jobs that depended on
    # environments which had no guarantee of having a unique digest. See
    # _env_images_that_can_be_deleted for its use.
    digest = db.Column(
        db.String(71),
        index=True,
        nullable=True,
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

    stored_in_registry = db.Column(
        db.Boolean(),
        nullable=False,
        # To migrate existing entries.
        server_default="True",
    )

    __table_args__ = (
        # To find all images of the environment of a project.
        Index(None, "project_uuid", "environment_uuid"),
        # To find the latest tag.
        Index(None, "project_uuid", "environment_uuid", tag.desc()),
        # To find active images with optional registry filtering.
        Index(None, "marked_for_removal", "stored_in_registry"),
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

    cluster_node = db.Column(
        db.String(),
        # Note that we SET NULL on deletion to avoid losing information
        # about the build if the nodes gets deleted.
        db.ForeignKey("cluster_nodes.name", ondelete="SET NULL"),
        # To migrate existing records.
        nullable=True,
    )

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

    stored_in_registry = db.Column(
        db.Boolean(),
        nullable=False,
        # To migrate existing entries.
        server_default="True",
    )

    __table_args__ = (
        # To find active images with optional registry filtering.
        Index(None, "marked_for_removal", "stored_in_registry"),
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

    snapshot_uuid = db.Column(
        db.String(36),
        db.ForeignKey("snapshots.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
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
            None,
            "project_uuid",
            "pipeline_uuid",
            "created_time",
        ),
        Index(
            None,
            "created_time",
            "project_uuid",
            "status",
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
    created_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=False,
        index=True,
        default=datetime.now(timezone.utc),
        # To migrate existing entries.
        server_default=text("timezone('utc', now())"),
    )
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

    pipeline_definition = db.Column(
        JSONB,
        nullable=False,
        # To migrate old entries.
        server_default="{}",
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


class Snapshot(BaseModel):
    __tablename__ = "snapshots"

    uuid = db.Column(db.String(36), primary_key=True)

    timestamp = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # This column will store every pipeline related information that is
    # not considered a secret. Will map pipeline uuids to a dict which
    # contains the pipeline path in the snapshot and the pipeline
    # definition.
    pipelines = db.Column(
        JSONB,
        nullable=False,
    )

    # Dictionary of environment variables, i.e. Dict[str, str].
    project_env_variables = deferred(
        db.Column(
            JSONB,
            nullable=False,
        )
    )

    # Dict[ppl uuid, Dict[str, str]].
    pipelines_env_variables = deferred(
        db.Column(
            JSONB,
            nullable=False,
        )
    )


class ClusterNode(BaseModel):
    """To track where some operations took place or where images are.

    We need this table because the images returned by the k8s node spec
    are limited, see
    https://github.com/kubernetes/kubernetes/issues/93488#issuecomment-664717977.

    """

    __tablename__ = "cluster_nodes"

    # https://kubernetes.io/docs/concepts/architecture/nodes/#node-name-uniqueness
    name = db.Column(db.String(), primary_key=True)


class EnvironmentImageOnNode(BaseModel):
    """To track where an environment image is stored."""

    __tablename__ = "environment_image_on_nodes"

    project_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
        primary_key=True,
    )

    environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True
    )

    environment_image_tag = db.Column(
        db.Integer, unique=False, nullable=False, primary_key=True
    )

    node_name = db.Column(db.String(), primary_key=True)


ForeignKeyConstraint(
    [
        EnvironmentImageOnNode.project_uuid,
        EnvironmentImageOnNode.environment_uuid,
        EnvironmentImageOnNode.environment_image_tag,
    ],
    [
        EnvironmentImage.project_uuid,
        EnvironmentImage.environment_uuid,
        EnvironmentImage.tag,
    ],
    ondelete="CASCADE",
)

ForeignKeyConstraint(
    [EnvironmentImageOnNode.node_name],
    [ClusterNode.name],
    ondelete="CASCADE",
)


class JupyterImageOnNode(BaseModel):
    """To track where a custom jupyter image is stored."""

    __tablename__ = "jupyter_image_on_nodes"

    jupyter_image_tag = db.Column(
        db.Integer, unique=False, nullable=False, primary_key=True
    )

    node_name = db.Column(db.String(), primary_key=True)


ForeignKeyConstraint(
    [JupyterImageOnNode.jupyter_image_tag],
    [JupyterImage.tag],
    ondelete="CASCADE",
)

ForeignKeyConstraint(
    [JupyterImageOnNode.node_name],
    [ClusterNode.name],
    ondelete="CASCADE",
)


class GitImport(BaseModel):
    """Model to persist git imports.

    The persisted data is of real interest only while the FE polls the
    status during a GUI import, i.e. schema migrations for this model
    are a bit less constrained than usual.
    """

    __tablename__ = "git_imports"

    uuid = db.Column(
        db.String(36), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # URL from where to fetch the project.
    url = db.Column(db.String(), nullable=False)
    # Name that the project should have after importing.
    requested_name = db.Column(db.String(255), nullable=True)

    project_uuid = db.Column(
        db.String(36),
        db.ForeignKey("projects.uuid", ondelete="CASCADE"),
        # Gets populated later in case of success.
        nullable=True,
    )

    status = db.Column(db.String(15), unique=False, nullable=False)
    # Used to deliver extra information such as error codes in a not so
    # much schema constrained way. Given that "old" data of this model
    # doesn't matter migrations can happen easily in case we want to
    # move to more tailored fields later.
    result = db.Column(JSONB, nullable=False, server_default="{}")

    def __repr__(self):
        return f"<GitImport: {self.uuid}>"


class AuthUser(BaseModel):
    """Model to persist a reference to auth users.

    Said reference is used to keep track of ownership of some Orchest
    entities created by the user, and to delete those upon the deletion
    of the user record.

    """

    __tablename__ = "auth_users"

    uuid = db.Column(db.String(36), primary_key=True)


class GitConfig(BaseModel):
    """Git config of the users.

    To be injected in contexts which require it.
    """

    __tablename__ = "git_configs"

    uuid = db.Column(db.String(36), primary_key=True)
    auth_user_uuid = db.Column(
        db.String(36),
        db.ForeignKey("auth_users.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
        unique=True,
    )
    name = db.Column(db.String(), nullable=False)
    email = db.Column(db.String(), nullable=False)


class SSHKey(BaseModel):
    """SSHKeys of the user.

    To be injected in contexts which require it. Note that this is
    pretty much an in-db reference, the secret part is stored as a k8s
    secret.
    """

    __tablename__ = "ssh_keys"

    uuid = db.Column(db.String(36), primary_key=True)
    auth_user_uuid = db.Column(
        db.String(36),
        db.ForeignKey("auth_users.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name = db.Column(db.String(), nullable=False)

    created_time = db.Column(
        db.DateTime,
        nullable=False,
        server_default=text("timezone('utc', now())"),
    )
