"""Models for the orchest-api

TODO:
    * Start using declarative base so we don't have to keep repeating
      the primary keys, relationships and foreignkeys.
      https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/mixins.html
    * Possibly add `pipeline_uuid` to the primary key.

"""
from sqlalchemy import Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP

from app.connections import db


class BaseModel(db.Model):
    # Because the class inherits from `db.Model` SQLAlachemy will try to
    # create the table. ``__abstract__=True`` prevents this.
    __abstract__ = True

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class EnvironmentBuild(BaseModel):
    """State of environment builds.

    Table meant to store the state of the build task of an environment,
    i.e. when we need to build an image starting from a base image plus
    optional sh code. This is not related to keeping track of
    environments or images to decide if a project or pipeline can be
    run.

    """

    __tablename__ = "environment_build"
    __table_args__ = (Index("uuid_proj_env_index", "project_uuid", "environment_uuid"),)

    # https://stackoverflow.com/questions/63164261/celery-task-id-max-length
    build_uuid = db.Column(db.String(36), primary_key=True, unique=True, nullable=False)
    project_uuid = db.Column(db.String(36), nullable=False, index=True)
    environment_uuid = db.Column(db.String(36), nullable=False, index=True)
    project_path = db.Column(db.String(4096), nullable=False, index=True)
    requested_time = db.Column(db.DateTime, unique=False, nullable=False)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)
    status = db.Column(db.String(15), unique=False, nullable=True)

    def __repr__(self):
        return f"<EnvironmentBuildTask: {self.build_uuid}>"


class InteractiveSession(BaseModel):
    __tablename__ = "interactive_sessions"

    project_uuid = db.Column(
        db.String(36),
        primary_key=True,
    )
    pipeline_uuid = db.Column(
        db.String(36),
        primary_key=True,
    )
    status = db.Column(
        db.String(10),
        primary_key=False,
    )
    # Used to connect to Jupyter notebook server.
    jupyter_server_ip = db.Column(
        db.String(15),
        unique=True,
        nullable=True,
    )  # IPv4
    # Used to connect to Jupyter notebook server.
    notebook_server_info = db.Column(
        JSONB,
        unique=True,
        nullable=True,
    )
    # Docker container IDs. Used internally to identify the resources of
    # a specific session.
    container_ids = db.Column(
        JSONB,
        unique=False,
        nullable=True,
    )

    def __repr__(self):
        return f"<Launch {self.pipeline_uuid}>"


class Job(BaseModel):
    __tablename__ = "jobs"

    job_name = db.Column(
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

    job_uuid = db.Column(db.String(36), primary_key=True)
    project_uuid = db.Column(
        db.String(36),
    )
    pipeline_uuid = db.Column(db.String(36), primary_key=False)

    # Jobs that are to be schedule once (right now) or once in the
    # future will have no schedule (null).
    schedule = db.Column(db.String(100), nullable=True)

    # A list of dictionaries. The length of the list is the number of
    # non interactive runs that will be run, one for each parameters
    # dictinary. A parameter dictionary maps step uuids to a dictionary,
    # containing the parameters of that step for that particular run.
    # [{ <step_uuid>: {"a": 1}, ...}, ...GG]
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

    # So that we can "stamp" every non interactive run with the
    # execution number it belongs to, e.g. the first time a job runs it
    # will be batch 1, then 2, etc.
    total_scheduled_executions = db.Column(
        db.Integer,
        unique=False,
        server_default=text("0"),
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

    # The status of a job can be DRAFT, PENDING, STARTED, SUCCESS,
    # ABORTED. Jobs start as DRAFT, this indicates that the job has
    # been created but that has not been started by the user. Once a
    # job is started by the user, what happens depends on the type of
    # job. One time jobs become PENDING, and become STARTED once they
    # are run by the scheduler and their pipeline runs are added to the
    # queue. Once they are completed, their status will be SUCCESS, if
    # they are aborted, their status will be set to ABORTED. Recurring
    # jobs, characterized by having a schedule, become STARTED, and can
    # only move to the ABORTED state in case they get cancelled, which
    # implies that the job will not be scheduled anymore.
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

    created_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=False,
        index=True,
        # For migrating users.
        server_default=text("timezone('utc', now())"),
    )

    def __repr__(self):
        return f"<Job: {self.job_uuid}>"


class PipelineRun(BaseModel):
    __tablename__ = "pipeline_runs"

    project_uuid = db.Column(
        db.String(36),
    )
    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
    )
    run_uuid = db.Column(db.String(36), primary_key=True)
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
    image_mappings = db.relationship(
        "PipelineRunImageMapping",
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
        return f"<{self.__class__.__name__}: {self.run_uuid}>"


class PipelineRunStep(BaseModel):
    __tablename__ = "pipeline_run_steps"

    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey("pipeline_runs.run_uuid", ondelete="CASCADE"),
        primary_key=True,
    )

    step_uuid = db.Column(db.String(36), primary_key=True)
    status = db.Column(db.String(15), unique=False, nullable=True)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.run_uuid}.{self.step_uuid}>"


class NonInteractivePipelineRun(PipelineRun):
    # https://docs.sqlalchemy.org/en/14/orm/inheritance.html
    # sqlalchemy has 3 kinds of inheritance: joined table, single table,
    # concrete.
    #
    # Concrete is, essentially, not recommended unsless you have a
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
        db.String(36), db.ForeignKey("jobs.job_uuid", ondelete="CASCADE"), index=True
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

    # related to inheriting from PipelineRun
    __mapper_args__ = {
        "polymorphic_identity": "NonInteractivePipelineRun",
    }


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


class PipelineRunImageMapping(BaseModel):
    """Stores mappings between a pipeline run and the environment
     images it uses.

    Used to understand if an image can be removed from the docker
    environment if it's not used by a run which is PENDING or STARTED.

    """

    __tablename__ = "pipeline_run_image_mappings"
    __table_args__ = (
        UniqueConstraint("run_uuid", "orchest_environment_uuid"),
        UniqueConstraint("run_uuid", "docker_img_id"),
    )

    run_uuid = db.Column(
        db.ForeignKey(PipelineRun.run_uuid, ondelete="CASCADE"),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )
    orchest_environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True, index=True
    )
    docker_img_id = db.Column(
        db.String(), unique=False, nullable=False, primary_key=True, index=True
    )

    def __repr__(self):
        return (
            f"<PipelineRunImageMapping: {self.run_uuid} | "
            f"{self.orchest_environment_uuid} | "
            f"{self.docker_img_id}>"
        )
