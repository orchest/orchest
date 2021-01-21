import uuid

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql import expression, text

from app.connections import db


def str_uuid4():
    return str(uuid.uuid4())


class Project(db.Model):
    __tablename__ = "project"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    path = db.Column(db.String(255), nullable=False, unique=True)
    # Can be: INITIALIZING, READY, DELETING. The status is used to avoid
    # race conditions and inconsistencies when discovering new projects
    # or projects that were deleted through the filesystem, given that
    # discovery can be concurrent to project deletion or creation.
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=False,
        # The default value is rather important, so that people having
        # their db automatically migrated will have projects in a valid
        # state.
        server_default=text("'READY'"),
    )

    __table_args__ = (UniqueConstraint("uuid", "path"),)
    jobs = db.relationship(
        "Job", lazy="joined", passive_deletes=False, cascade="all, delete"
    )


class Pipeline(db.Model):
    __tablename__ = "pipeline"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    project_uuid = db.Column(
        db.ForeignKey("project.uuid", ondelete="CASCADE"), primary_key=True
    )
    path = db.Column(db.String(255), nullable=False)

    __table_args__ = (UniqueConstraint("uuid", "project_uuid"),)


class DataSource(db.Model):
    __tablename__ = "datasources"

    name = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    source_type = db.Column(db.String(100), nullable=False)
    connection_details = db.Column(db.JSON, nullable=False)
    created = db.Column(
        db.DateTime, nullable=False, server_default=text("timezone('utc', now())")
    )

    def __repr__(self):
        return f"<DataSource {self.name}:{self.source_type}>"


# This class is only serialized on disk, it's never stored in the
# database. The properties are stored in properties.json in the
# <project>/.orchest/environments/<environment_uuid>/. directory.
# to avoid unknowingly querying a table that will always be empty, the
# table is deleted
# see __init__ at around line 120, after the db is initialized
class Environment(db.Model):
    __tablename__ = "environments"

    uuid = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
        primary_key=True,
        # using a server_default would require to install a postgres
        # plugin, leaving it as an ORM-only default
        default=str_uuid4,
    )
    name = db.Column(db.String(255), unique=False, nullable=False)
    project_uuid = db.Column(db.String(255), unique=False, nullable=False)
    language = db.Column(db.String(255), nullable=False)

    # Startup script is stored as separate file (start_script.sh)
    setup_script = db.Column(db.String(255), server_default="")
    base_image = db.Column(db.String(255), nullable=False)
    gpu_support = db.Column(
        db.Boolean, nullable=False, server_default=expression.false()
    )

    def __repr__(self):
        return f"<Environment {self.name}:{self.base_image}:{self.uuid}>"


class Job(db.Model):
    __tablename__ = "jobs"

    name = db.Column(db.String(255), unique=False, nullable=False)
    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    pipeline_uuid = db.Column(db.String(255), unique=False, nullable=False)
    project_uuid = db.Column(
        db.ForeignKey("project.uuid", ondelete="CASCADE"), unique=False, nullable=False
    )
    pipeline_name = db.Column(db.String(255), unique=False, nullable=False)
    pipeline_path = db.Column(db.String(255), unique=False, nullable=False)
    created = db.Column(
        db.DateTime, nullable=False, server_default=text("timezone('utc', now())")
    )
    strategy_json = db.Column(db.Text, nullable=False)
    draft = db.Column(db.Boolean())


class BackgroundTask(db.Model):
    """BackgroundTasks, models all tasks to be run in the background."""

    __tablename__ = "background_tasks"

    task_uuid = db.Column(db.String(36), primary_key=True, unique=True, nullable=False)
    # see background_task_executor types
    task_type = db.Column(db.String(50), unique=False, nullable=True)
    status = db.Column(db.String(15), unique=False, nullable=False)
    code = db.Column(db.String(15), unique=False, nullable=True)
    result = db.Column(db.String(), unique=False, nullable=True)

    def __repr__(self):
        return f"<BackgroundTask: {self.task_uuid}>"
