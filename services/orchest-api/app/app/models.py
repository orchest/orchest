"""Models for the orchest-api

TODO:
    * Start using declarative base so we don't have to keep repeating
      the primary keys, relationships and foreignkeys.
      https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/mixins.html
    * Possibly add `pipeline_uuid` to the primary key.

"""
from sqlalchemy import Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB

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


class Experiment(BaseModel):
    __tablename__ = "experiments"

    experiment_uuid = db.Column(db.String(36), primary_key=True)
    project_uuid = db.Column(
        db.String(36),
    )
    pipeline_uuid = db.Column(db.String(36), primary_key=False)
    total_number_of_pipeline_runs = db.Column(
        db.Integer,
        unique=False,
        nullable=False,
    )
    scheduled_start = db.Column(db.DateTime, nullable=False)
    completed_pipeline_runs = db.Column(
        db.Integer,
        unique=False,
        server_default=text("0"),
    )
    pipeline_runs = db.relationship(
        "NonInteractivePipelineRun",
        lazy="joined",
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
    )

    def __repr__(self):
        return f"<Experiment: {self.experiment_uuid}>"


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

    # TODO: verify why the experiment_uuid should be part of the
    # primary key
    experiment_uuid = db.Column(
        db.String(36),
        db.ForeignKey("experiments.experiment_uuid", ondelete="CASCADE"),
    )
    # This run_id is used to identify the pipeline run within the
    # experiment and maintain a consistent ordering.
    pipeline_run_id = db.Column(
        db.Integer,
        unique=False,
    )

    # related to inheriting from PipelineRun
    __mapper_args__ = {
        "polymorphic_identity": "NonInteractivePipelineRun",
    }


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
