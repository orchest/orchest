"""Models for the orchest-api

TODO:
    * Start using declarative base so we don't have to keep repeating
      the primary keys, relationships and foreignkeys.
      https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/mixins.html
    * Possibly add `pipeline_uuid` to the primary key.

"""
from app.connections import db
from sqlalchemy import Index, UniqueConstraint, ForeignKeyConstraint


class BaseModel(db.Model):
    # Because the class inherits from `db.Model` SQLAlachemy will try to
    # create the table. ``__abstract__=True`` prevents this.
    __abstract__ = True

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


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
        db.JSON,
        unique=True,
        nullable=True,
    )
    # Docker container IDs. Used internally to identify the resources of
    # a specific session.
    container_ids = db.Column(
        db.JSON,
        unique=False,
        nullable=True,
    )

    def __repr__(self):
        return f"<Launch {self.pipeline_uuid}>"


class PipelineRun(BaseModel):
    __abstract__ = True

    project_uuid = db.Column(
        db.String(36),
    )
    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False,
    )
    status = db.Column(db.String(15), unique=False, nullable=True)

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.run_uuid}>"


class PipelineRunPipelineStep(BaseModel):
    __abstract__ = True

    step_uuid = db.Column(db.String(36), primary_key=True)
    status = db.Column(db.String(15), unique=False, nullable=True)
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.run_uuid}.{self.step_uuid}>"


class InteractiveRunPipelineStep(PipelineRunPipelineStep):
    __tablename__ = "interactive_run_pipeline_steps"

    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey("interactive_runs.run_uuid", ondelete="CASCADE"),
        primary_key=True,
    )


class InteractiveRun(PipelineRun):
    __tablename__ = "interactive_runs"

    run_uuid = db.Column(db.String(36), primary_key=True)

    # https://docs.sqlalchemy.org/en/14/orm/cascades.html#using-foreign-key-on-delete-cascade-with-orm-relationships
    # In order to use ON DELETE foreign key cascades in conjunction
    # with relationship(), it’s important to note first and foremost
    # that the relationship.cascade setting must still be configured
    # to match the desired “delete” or “set null” behavior
    # Essentially, the specifed behaviour in the FK column
    # and the one specified in the relationship must match.
    pipeline_steps = db.relationship(
        "InteractiveRunPipelineStep",
        lazy="joined",
        # do not rely on the db to delete
        # TODO: can be set to true after we move away from sqllite
        passive_deletes=False,
        cascade="all, delete",
    )
    image_mappings = db.relationship(
        "InteractiveRunImageMapping",
        lazy="joined",
        passive_deletes=False,
        cascade="all, delete",
    )


class NonInteractiveRun(PipelineRun):
    __tablename__ = "non_interactive_runs"
    __bind_key__ = "persistent_db"

    # TODO: verify why the experiment_uuid should be part of the
    # primary key
    experiment_uuid = db.Column(
        db.String(36),
        db.ForeignKey("experiments.experiment_uuid", ondelete="CASCADE"),
        primary_key=True,
    )
    # needs to be unique to be a FK constraint for images mappings
    # that can delete on cascade
    run_uuid = db.Column(db.String(36), primary_key=True, unique=True)
    # This run_id is used to identify the pipeline run within the
    # experiment and maintain a consistent ordering.
    pipeline_run_id = db.Column(
        db.Integer,
        unique=False,
        nullable=False,
    )
    started_time = db.Column(db.DateTime, unique=False, nullable=True)
    finished_time = db.Column(db.DateTime, unique=False, nullable=True)

    pipeline_steps = db.relationship(
        "NonInteractiveRunPipelineStep",
        lazy="joined",
        passive_deletes=False,
        cascade="all, delete",
    )
    image_mappings = db.relationship(
        "NonInteractiveRunImageMapping",
        lazy="joined",
        passive_deletes=False,
        cascade="all, delete",
    )


class NonInteractiveRunPipelineStep(PipelineRunPipelineStep):
    __tablename__ = "non_interactive_run_pipeline_steps"
    __bind_key__ = "persistent_db"

    # TODO: verify why we have the exp uuid as a column, seems to be
    # redundant info since we already have the run_uuid
    experiment_uuid = db.Column(
        db.String(36),
        primary_key=True,
    )
    run_uuid = db.Column(
        db.String(36),
        primary_key=True,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            [experiment_uuid, run_uuid],
            [NonInteractiveRun.experiment_uuid, NonInteractiveRun.run_uuid],
            ondelete="CASCADE",
        ),
    )


class Experiment(BaseModel):
    __tablename__ = "experiments"
    __bind_key__ = "persistent_db"

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
        default=0,
    )

    pipeline_runs = db.relationship(
        "NonInteractiveRun", lazy="joined", passive_deletes=False, cascade="all, delete"
    )

    def __repr__(self):
        return f"<Experiment: {self.experiment_uuid}>"


class EnvironmentBuild(BaseModel):
    """State of environment builds.

    Table meant to store the state of the build task of an environment,
    i.e. when we need to build an image starting from a base image plus
    optional sh code. This is not related to keeping track of
    environments or images to decide if a project or pipeline can be
    run.

    """

    __tablename__ = "environment_build"
    __bind_key__ = "persistent_db"
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


class InteractiveRunImageMapping(BaseModel):
    """Stores mappings between an interactive run and the environment
     images it uses.

    Used to understand if an image can be removed from the docker
    environment if it's not used by a run which is PENDING or STARTED.

    """

    __tablename__ = "interactive_run_image_mapping"
    __table_args__ = (
        UniqueConstraint("run_uuid", "orchest_environment_uuid"),
        UniqueConstraint("run_uuid", "docker_img_id"),
    )

    run_uuid = db.Column(
        db.ForeignKey(InteractiveRun.run_uuid, ondelete="CASCADE"),
        unique=False,
        nullable=False,
        index=True,
        primary_key=True,
    )
    orchest_environment_uuid = db.Column(
        db.String(36), unique=False, nullable=False, primary_key=True
    )
    docker_img_id = db.Column(
        db.String(), unique=False, nullable=False, primary_key=True
    )

    def __repr__(self):
        return (
            f"<InteractiveRunImageMapping: {self.run_uuid} | "
            f"{self.orchest_environment_uuid} | "
            f"{self.docker_img_id}>"
        )


class NonInteractiveRunImageMapping(BaseModel):
    """Stores mappings between a non interactive run and the environment
     images it uses.

    Used to understand if an image can be removed from the docker
    environment if it's not used by a run which is PENDING or STARTED.

    """

    __tablename__ = "non_interactive_pipeline_run_image_mapping"
    __bind_key__ = "persistent_db"
    __table_args__ = (
        UniqueConstraint("run_uuid", "orchest_environment_uuid"),
        UniqueConstraint("run_uuid", "docker_img_id"),
    )

    run_uuid = db.Column(
        db.ForeignKey(NonInteractiveRun.run_uuid, ondelete="CASCADE"),
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
            f"<NonInteractiveRunImageMapping: {self.run_uuid} | "
            f"{self.orchest_environment_uuid} | "
            f"{self.docker_img_id}>"
        )
